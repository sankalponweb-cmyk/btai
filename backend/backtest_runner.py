"""
backtest_runner.py
==================
Orchestrates the full backtest pipeline using the skill's scripts:
  1. Fetch real price data via yfinance (data_fetch.py)
  2. Compute indicators (indicators.py)
  3. Exec the Claude-generated on_bar code
  4. Run the backtest engine (engine.py)
  5. Compute metrics (metrics.py)
  6. Build the Excel report (report.py  — exact 5-sheet skill format)
  7. Build the PDF report
Returns a summary dict (for the frontend) and the paths to the generated files.
"""

import os
import sys
import types
import traceback

import numpy as np
import pandas as pd

# ── Add skills/ to path so we can import the skill modules ──────────────────
_SKILLS_DIR = os.path.join(os.path.dirname(__file__), "skills")
if _SKILLS_DIR not in sys.path:
    sys.path.insert(0, _SKILLS_DIR)

import data_fetch as df_module
import indicators as ind
from engine import run_backtest
from metrics import performance_metrics, trade_statistics, annual_returns
import report as report_module

from report_pdf import generate_pdf
from data_cleaner import clean_price_data


def _remap_to_period_end(df: pd.DataFrame, bar_frequency: str) -> pd.DataFrame:
    """
    Remap yfinance bar index dates to the LAST day of each period.

    yfinance weekly bars are stamped with Monday (start of the week);
    monthly bars are stamped with the 1st (start of the month).  Both
    conventions make it impossible to match a trade-log entry to the
    correct row in the historical data sheet because the trade executes
    at the bar's CLOSE, which is Friday (weekly) or the last business
    day of the month (monthly).

    After remapping:
      weekly  → each bar date is the Friday of that week  (Mon + 4 days)
      monthly → each bar date is the last business day of that month
      daily   → unchanged
    """
    if bar_frequency == "daily":
        return df
    df = df.copy()
    idx = pd.to_datetime(df.index)
    if bar_frequency == "weekly":
        # Monday + 4 calendar days = Friday of the same week.
        # Works correctly for every standard 5-day trading week; for weeks
        # shortened by public holidays the label will be the Friday of that
        # week even if the market closed on Thursday — the OHLCV data
        # already reflects the actual last-traded prices.
        df.index = idx + pd.Timedelta(days=4)
    elif bar_frequency == "monthly":
        # BMonthEnd(0): maps any date to the last business day of its own
        # month (stays put if already on the last business day).
        df.index = idx + pd.offsets.BMonthEnd(0)
    df.index.name = "Date"
    return df


def run(spec: dict, download_dir: str) -> dict:
    """
    Parameters
    ----------
    spec : dict   output from claude_client.parse_strategy()
    download_dir  : str  where to write the xlsx and pdf files

    Returns
    -------
    dict with keys: summary (frontend metrics), excel_path, pdf_path
    """
    os.makedirs(download_dir, exist_ok=True)

    tickers          = spec["tickers"]
    benchmark_ticker = spec.get("benchmark_ticker", "^NSEI")
    start_date       = spec.get("start_date", "2019-01-01")
    end_date         = spec.get("end_date") or None
    initial_capital  = float(spec.get("initial_capital", 1_000_000))
    commission_bps   = float(spec.get("commission_bps", 5.0))
    slippage_bps     = float(spec.get("slippage_bps", 5.0))
    risk_free_rate   = float(spec.get("risk_free_rate", 0.07))

    # ── Bar frequency: determines what data is downloaded and periods/yr ──
    bar_frequency = spec.get("bar_frequency", "daily").lower()
    _interval_map      = {"daily": "1d", "weekly": "1wk", "monthly": "1mo"}
    _periods_map       = {"daily": 252,  "weekly": 52,    "monthly": 12}
    _gap_day_map       = {"daily": 7,    "weekly": 14,    "monthly": 45}
    _stale_run_map     = {"daily": 8,    "weekly": 3,     "monthly": 2}
    if bar_frequency not in _interval_map:
        bar_frequency = "daily"

    yf_interval      = _interval_map[bar_frequency]
    # periods_per_year is authoritative from the spec if explicitly set there,
    # otherwise derive it from bar_frequency
    periods_per_year = int(spec.get("periods_per_year") or _periods_map[bar_frequency])

    cache_dir = os.path.join(download_dir, "data_cache")

    # ── 1. Fetch price data at the correct bar frequency ─────────────────
    all_tickers = list(tickers)
    if benchmark_ticker and benchmark_ticker not in all_tickers:
        all_tickers.append(benchmark_ticker)

    price_data_all = df_module.fetch_prices(
        all_tickers, start=start_date, end=end_date,
        cache_dir=cache_dir, interval=yf_interval,
    )

    # ── 1a. Remap bar dates to last day of each period ────────────────────
    # yfinance labels weekly bars with the MONDAY (start of week) and monthly
    # bars with the 1st (start of month).  Remapping to Friday / last business
    # day of the month means every row in the historical data, trade log, and
    # equity curve carries the date the bar actually CLOSED on, so users can
    # directly cross-reference a trade entry with the corresponding row in the
    # historical data sheet without the Monday↔Friday confusion.
    price_data_all = {t: _remap_to_period_end(df, bar_frequency)
                      for t, df in price_data_all.items()}

    price_data = {t: price_data_all[t] for t in tickers if t in price_data_all}
    if not price_data:
        raise RuntimeError("No price data returned for strategy tickers. Check network access to Yahoo Finance.")

    # ── 1b. Detect data range shortfall and fall back to best available ───
    # yfinance already returns whatever data exists from the requested start;
    # we just surface a note to the user when the actual range is shorter.
    _req_start = pd.Timestamp(start_date)
    range_notes = []
    for t, df in price_data.items():
        if df.empty:
            continue
        actual_start = df.index.min()
        if actual_start > _req_start + pd.Timedelta(days=60):
            yrs_req   = round((pd.Timestamp.today() - _req_start).days / 365.25, 1)
            yrs_avail = round((pd.Timestamp.today() - actual_start).days / 365.25, 1)
            range_notes.append(
                f"{t}: only {yrs_avail}yr of data available from "
                f"{actual_start.strftime('%b %Y')} (requested {yrs_req}yr from "
                f"{_req_start.strftime('%b %Y')}). Using best available data."
            )

    # ── 1d. Detect and auto-correct data anomalies ────────────────────────
    price_data, anomaly_msgs = clean_price_data(
        price_data,
        gap_days=_gap_day_map[bar_frequency],
        stale_run_bars=_stale_run_map[bar_frequency],
    )

    anomaly_msgs = range_notes + anomaly_msgs   # data-range notes come first

    # Also clean the benchmark series if present
    benchmark_series = None
    if benchmark_ticker and benchmark_ticker in price_data_all:
        bdf_cleaned, _ = clean_price_data(
            {benchmark_ticker: price_data_all[benchmark_ticker]},
            gap_days=_gap_day_map[bar_frequency],
            stale_run_bars=_stale_run_map[bar_frequency],
        )
        bdf = bdf_cleaned[benchmark_ticker]
        col = next((c for c in bdf.columns if c.lower() == "close"), None)
        if col:
            bseries = bdf[col].copy()
            # Strip timezone so it aligns with the equity curve index produced
            # by the engine (which uses tz-naive timestamps). A tz mismatch
            # causes reindex() to return all-NaN → dropna() → empty → no benchmark.
            if hasattr(bseries.index, "tz") and bseries.index.tz is not None:
                bseries.index = bseries.index.tz_localize(None)
            bseries.index = pd.to_datetime(bseries.index)
            benchmark_series = bseries

    # ── 1e. Normalise all price_data timestamps to tz-naive ──────────────
    for t in list(price_data.keys()):
        df_t = price_data[t]
        if hasattr(df_t.index, "tz") and df_t.index.tz is not None:
            price_data[t] = df_t.copy()
            price_data[t].index = df_t.index.tz_localize(None)

    # ── 2. Compute indicators ─────────────────────────────────────────────
    closes = {t: df["Close"] if "Close" in df.columns else df[df.columns[3]]
              for t, df in price_data.items()}

    indicators_code = spec.get("indicators_code", "extra_data = {}")
    # Single namespace dict — avoids Python closure scoping issues when
    # exec(code, globals, locals) uses separate dicts (functions defined in
    # the exec'd code can't see locals via their __globals__).
    ind_ns = {
        "pd": pd, "np": np,
        "ind": ind,
        "closes": closes,
        "price_data": price_data,
    }
    try:
        exec(indicators_code, ind_ns)  # noqa: S102
    except Exception as e:
        raise RuntimeError(f"Indicator code execution failed: {e}\n{traceback.format_exc()}")

    extra_data = ind_ns.get("extra_data", {})

    # ── 3. Build on_bar function ──────────────────────────────────────────
    on_bar_code = spec["on_bar_code"]
    # Single namespace so any state dict defined outside on_bar() (e.g.
    # `state = {}`) is visible to the function's closure at runtime.
    ob_ns = {"pd": pd, "np": np, "ind": ind}
    try:
        exec(on_bar_code, ob_ns)  # noqa: S102
    except Exception as e:
        raise RuntimeError(f"on_bar code execution failed: {e}\n{traceback.format_exc()}")

    on_bar = ob_ns.get("on_bar")
    if on_bar is None:
        raise RuntimeError("on_bar function not found in the generated code.")

    # ── 4. Run the backtest ───────────────────────────────────────────────
    # Default execution model: orders fill at the same bar's close price.
    # Claude can override this by setting "fill_on": "next_open" in the spec
    # for strategies that explicitly require next-bar open execution.
    fill_on = spec.get("fill_on", "close")
    result = run_backtest(
        price_data=price_data,
        on_bar=on_bar,
        initial_capital=initial_capital,
        commission_bps=commission_bps,
        slippage_bps=slippage_bps,
        extra_data=extra_data,
        benchmark=benchmark_series,
        fill_on=fill_on,
    )

    # ── 5. Compute metrics ────────────────────────────────────────────────
    perf   = performance_metrics(result, risk_free_rate=risk_free_rate,
                                  periods_per_year=periods_per_year)
    tstats = trade_statistics(result.trade_log)
    ann_df = annual_returns(result.equity_curve)

    # ── 6. Build Excel (exact 5-sheet skill format) ───────────────────────
    strategy_info = {
        "name":           spec.get("strategy_name", "Strategy Backtest"),
        "description":    spec.get("description", ""),
        "universe":       tickers,
        "commission_bps": commission_bps,
        "slippage_bps":   slippage_bps,
    }
    excel_path = os.path.join(download_dir, "backtest_report.xlsx")
    report_module.build_report(
        excel_path,
        result,
        price_data,
        strategy_info=strategy_info,
        risk_free_rate=risk_free_rate,
        periods_per_year=periods_per_year,
        annual_returns_df=ann_df,
    )

    # ── 7. Build PDF ──────────────────────────────────────────────────────
    pdf_path = os.path.join(download_dir, "backtest_report.pdf")
    generate_pdf(
        path=pdf_path,
        spec=spec,
        perf=perf,
        tstats=tstats,
        trade_log=result.trade_log,
        equity_curve=result.equity_curve,
        benchmark_curve=result.benchmark_curve,
        ann_df=ann_df,
    )

    # ── 8. Build frontend summary ─────────────────────────────────────────
    eq = result.equity_curve.dropna()
    bench_curve = result.benchmark_curve  # already normalised to initial_capital

    equity_curve_list = []
    for d, v in eq.items():
        entry = {"date": str(d.date()), "portfolio_value": round(float(v), 2)}
        if bench_curve is not None and d in bench_curve.index:
            bv = bench_curve[d]
            if pd.notna(bv):
                entry["benchmark_value"] = round(float(bv), 2)
        equity_curve_list.append(entry)

    tl = result.trade_log
    total_trades     = int(tstats.get("Total Trades", 0))
    profitable       = int(tstats.get("Winning Trades", 0))
    win_rate         = float(tstats.get("Win Rate (%)", 0.0))
    avg_trade_ret    = float(tstats.get("Avg Trade Return (%)", 0.0))
    best_trade       = float(tstats.get("Largest Win (₹)", 0.0))
    worst_trade      = float(tstats.get("Largest Loss (₹)", 0.0))

    # Convert best/worst trade from ₹ P&L to % return for display
    if not tl.empty and "return_pct" in tl.columns:
        best_trade_pct  = float(tl["return_pct"].max() * 100)
        worst_trade_pct = float(tl["return_pct"].min() * 100)
    else:
        best_trade_pct  = 0.0
        worst_trade_pct = 0.0

    summary = {
        "strategy_name": spec.get("strategy_name", "Strategy"),
        "description":   spec.get("description", ""),
        "rules":         spec.get("rules", []),
        "metrics": {
            "total_return_pct":    round(perf.get("Total Return (%)", 0.0), 2),
            "cagr_pct":            round(perf.get("CAGR (%)", 0.0), 2),
            "sharpe_ratio":        round(float(perf.get("Sharpe Ratio", 0) or 0), 2),
            "sortino_ratio":       round(float(perf.get("Sortino Ratio", 0) or 0), 2),
            "calmar_ratio":        round(float(perf.get("Calmar Ratio", 0) or 0), 2),
            "max_drawdown_pct":    round(perf.get("Max Drawdown (%)", 0.0), 2),
            "ann_volatility_pct":  round(perf.get("Annualized Volatility (%)", 0.0), 2),
            "win_rate_pct":        round(win_rate, 1),
            "total_trades":        total_trades,
            "profitable_trades":   profitable,
            "avg_trade_return_pct": round(avg_trade_ret, 2),
            "best_trade_pct":      round(best_trade_pct, 2),
            "worst_trade_pct":     round(worst_trade_pct, 2),
            "starting_capital":    initial_capital,
            "ending_value":        round(float(eq.iloc[-1]) if len(eq) else initial_capital, 2),
            "best_day_pct":        round(perf.get("Best Day (%)", 0.0), 2),
            "worst_day_pct":       round(perf.get("Worst Day (%)", 0.0), 2),
            "avg_exposure_pct":    round(perf.get("Average Exposure (%)", 0.0), 2),
            "start_date":          perf.get("Start Date", ""),
            "end_date":            perf.get("End Date", ""),
            "benchmark_total_return_pct": (
                round(float(perf["Benchmark Total Return (%)"]), 2)
                if perf.get("Benchmark Total Return (%)") is not None
                and not (isinstance(perf["Benchmark Total Return (%)"], float) and np.isnan(perf["Benchmark Total Return (%)"]))
                else None
            ),
            "benchmark_cagr_pct": (
                round(float(perf["Benchmark CAGR (%)"]), 2)
                if perf.get("Benchmark CAGR (%)") is not None
                and not (isinstance(perf["Benchmark CAGR (%)"], float) and np.isnan(perf["Benchmark CAGR (%)"]))
                else None
            ),
        },
        "equity_curve":  equity_curve_list,
        "data_anomalies": anomaly_msgs,
        "benchmark_ticker": benchmark_ticker or None,
    }

    return {
        "summary":    summary,
        "excel_path": excel_path,
        "pdf_path":   pdf_path,
    }
