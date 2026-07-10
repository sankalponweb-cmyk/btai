"""
metrics.py
==========
Performance-metric and trade-statistic calculations from a BacktestResult.

Two main entry points:
- `performance_metrics(result, risk_free_rate=0.0, periods_per_year=252)`
  -> dict of strategy-level metrics (CAGR, Sharpe, max drawdown, etc.)
- `trade_statistics(trade_log_df)`
  -> dict of trade-level metrics (win rate, profit factor, avg win/loss, etc.)

All ratios assume daily-frequency equity curves by default; pass
`periods_per_year=52` for weekly curves, etc.
"""

import numpy as np
import pandas as pd


def _annualization_factor(periods_per_year: int) -> float:
    return float(periods_per_year)


def performance_metrics(result, risk_free_rate: float = 0.0,
                         periods_per_year: int = 252) -> dict:
    """
    result: a BacktestResult (or anything with .equity_curve, .drawdown,
            .exposure, .meta['initial_capital'])
    risk_free_rate: annual risk-free rate as a decimal (e.g. 0.07 for 7%),
                    used for Sharpe/Sortino excess-return calculations.
    """
    eq = result.equity_curve.dropna()
    if len(eq) < 2:
        return {"error": "Not enough data points to compute metrics."}

    initial_capital = result.meta.get("initial_capital", eq.iloc[0])
    final_value = eq.iloc[-1]

    daily_returns = eq.pct_change().fillna(0)

    n_days = (eq.index[-1] - eq.index[0]).days
    years = n_days / 365.25 if n_days > 0 else len(eq) / periods_per_year

    total_return = (final_value / initial_capital) - 1
    cagr = (final_value / initial_capital) ** (1 / years) - 1 if years > 0 else np.nan

    ann_factor = _annualization_factor(periods_per_year)
    ann_vol = daily_returns.std() * np.sqrt(ann_factor)

    rf_per_period = risk_free_rate / ann_factor
    excess_returns = daily_returns - rf_per_period

    sharpe = (
        (excess_returns.mean() / excess_returns.std()) * np.sqrt(ann_factor)
        if excess_returns.std() > 0 else np.nan
    )

    downside = excess_returns[excess_returns < 0]
    sortino = (
        (excess_returns.mean() / downside.std()) * np.sqrt(ann_factor)
        if len(downside) > 0 and downside.std() > 0 else np.nan
    )

    dd = result.drawdown.dropna()
    max_dd = dd.min() if len(dd) else np.nan

    calmar = (cagr / abs(max_dd)) if max_dd not in (0, np.nan) and not np.isnan(max_dd) else np.nan

    # max drawdown duration: longest stretch (in days) spent below a prior peak
    max_dd_duration = _max_drawdown_duration(eq)

    # current drawdown / time since last peak
    current_dd = dd.iloc[-1] if len(dd) else np.nan

    avg_exposure = result.exposure.mean() if result.exposure is not None and len(result.exposure) else np.nan

    # CAGR of benchmark, if provided
    benchmark_cagr = np.nan
    benchmark_total_return = np.nan
    if result.benchmark_curve is not None and len(result.benchmark_curve) > 1:
        b = result.benchmark_curve.dropna()
        b_years = (b.index[-1] - b.index[0]).days / 365.25
        benchmark_total_return = (b.iloc[-1] / b.iloc[0]) - 1
        benchmark_cagr = (b.iloc[-1] / b.iloc[0]) ** (1 / b_years) - 1 if b_years > 0 else np.nan

    # best / worst single-period returns
    best_day = daily_returns.max() if len(daily_returns) else np.nan
    worst_day = daily_returns.min() if len(daily_returns) else np.nan

    # rolling 1yr / 3yr returns (informational)
    win_rate_periods = (daily_returns > 0).mean() if len(daily_returns) else np.nan

    metrics = {
        "Start Date": eq.index[0].strftime("%Y-%m-%d"),
        "End Date": eq.index[-1].strftime("%Y-%m-%d"),
        "Duration (Years)": round(years, 2),
        "Initial Capital": initial_capital,
        "Final Equity": final_value,
        "Total Return (%)": total_return * 100,
        "CAGR (%)": cagr * 100,
        "Annualized Volatility (%)": ann_vol * 100,
        "Sharpe Ratio": sharpe,
        "Sortino Ratio": sortino,
        "Calmar Ratio": calmar,
        "Max Drawdown (%)": max_dd * 100,
        "Max Drawdown Duration (days)": max_dd_duration,
        "Current Drawdown (%)": current_dd * 100,
        "Average Exposure (%)": avg_exposure * 100 if not np.isnan(avg_exposure) else np.nan,
        "Best Day (%)": best_day * 100,
        "Worst Day (%)": worst_day * 100,
        "Positive Periods (%)": win_rate_periods * 100,
        "Benchmark Total Return (%)": benchmark_total_return * 100 if not np.isnan(benchmark_total_return) else np.nan,
        "Benchmark CAGR (%)": benchmark_cagr * 100 if not np.isnan(benchmark_cagr) else np.nan,
        "Risk-Free Rate Used (%)": risk_free_rate * 100,
    }
    return metrics


def _max_drawdown_duration(equity: pd.Series) -> int:
    """Longest number of calendar days spent below a previous equity peak."""
    running_max = equity.cummax()
    in_dd = equity < running_max
    if not in_dd.any():
        return 0

    longest = 0
    start = None
    dates = equity.index
    for i, flag in enumerate(in_dd):
        if flag and start is None:
            start = dates[i]
        elif not flag and start is not None:
            longest = max(longest, (dates[i - 1] - start).days)
            start = None
    if start is not None:
        longest = max(longest, (dates[-1] - start).days)
    return longest


def trade_statistics(trade_log_df: pd.DataFrame) -> dict:
    """Compute trade-level statistics from a trade log DataFrame (as
    produced by engine.run_backtest -> result.trade_log)."""
    if trade_log_df is None or trade_log_df.empty:
        return {"Total Trades": 0}

    df = trade_log_df.copy()
    total_trades = len(df)
    wins = df[df["pnl"] > 0]
    losses = df[df["pnl"] <= 0]

    win_rate = len(wins) / total_trades if total_trades else np.nan
    avg_win = wins["pnl"].mean() if len(wins) else 0.0
    avg_loss = losses["pnl"].mean() if len(losses) else 0.0
    gross_profit = wins["pnl"].sum() if len(wins) else 0.0
    gross_loss = losses["pnl"].sum() if len(losses) else 0.0
    profit_factor = (gross_profit / abs(gross_loss)) if gross_loss != 0 else np.inf

    expectancy = df["pnl"].mean()
    avg_return_pct = df["return_pct"].mean() * 100 if "return_pct" in df else np.nan
    avg_win_pct = wins["return_pct"].mean() * 100 if len(wins) and "return_pct" in df else np.nan
    avg_loss_pct = losses["return_pct"].mean() * 100 if len(losses) and "return_pct" in df else np.nan

    avg_holding = df["holding_days"].mean() if "holding_days" in df else np.nan
    avg_holding_win = wins["holding_days"].mean() if len(wins) and "holding_days" in df else np.nan
    avg_holding_loss = losses["holding_days"].mean() if len(losses) and "holding_days" in df else np.nan

    # consecutive wins/losses
    pnl_sign = np.sign(df["pnl"].values)
    max_consec_wins = _max_consecutive(pnl_sign, 1)
    max_consec_losses = _max_consecutive(pnl_sign, -1)

    largest_win = df["pnl"].max() if total_trades else np.nan
    largest_loss = df["pnl"].min() if total_trades else np.nan

    payoff_ratio = (avg_win / abs(avg_loss)) if avg_loss != 0 else np.inf

    return {
        "Total Trades": total_trades,
        "Winning Trades": len(wins),
        "Losing Trades": len(losses),
        "Win Rate (%)": win_rate * 100,
        "Profit Factor": profit_factor,
        "Payoff Ratio": payoff_ratio,
        "Expectancy (₹/unit)": expectancy,
        "Avg Trade Return (%)": avg_return_pct,
        "Avg Win (%)": avg_win_pct,
        "Avg Loss (%)": avg_loss_pct,
        "Avg Win (₹)": avg_win,
        "Avg Loss (₹)": avg_loss,
        "Largest Win (₹)": largest_win,
        "Largest Loss (₹)": largest_loss,
        "Gross Profit (₹)": gross_profit,
        "Gross Loss (₹)": gross_loss,
        "Avg Holding Period (days)": avg_holding,
        "Avg Holding Period - Wins (days)": avg_holding_win,
        "Avg Holding Period - Losses (days)": avg_holding_loss,
        "Max Consecutive Wins": max_consec_wins,
        "Max Consecutive Losses": max_consec_losses,
    }


def _max_consecutive(signs: np.ndarray, target: int) -> int:
    best = cur = 0
    for s in signs:
        if (s > 0 and target > 0) or (s <= 0 and target < 0):
            cur += 1
            best = max(best, cur)
        else:
            cur = 0
    return best


def per_ticker_breakdown(trade_log_df: pd.DataFrame) -> pd.DataFrame:
    """Win rate / total P&L / trade count grouped by ticker -- handy for
    multi-asset portfolios to see which instruments drove performance."""
    if trade_log_df is None or trade_log_df.empty:
        return pd.DataFrame()
    g = trade_log_df.groupby("ticker")
    out = g.apply(lambda d: pd.Series({
        "Trades": len(d),
        "Win Rate (%)": (d["pnl"] > 0).mean() * 100,
        "Total P&L (₹)": d["pnl"].sum(),
        "Avg Return (%)": d["return_pct"].mean() * 100,
    }))
    return out.sort_values("Total P&L (₹)", ascending=False)


def annual_returns(equity_curve: pd.Series) -> pd.DataFrame:
    """Year-by-year return table for the equity curve."""
    eq = equity_curve.dropna()
    yearly = eq.resample("YE").last()
    yearly_start = eq.resample("YE").first()
    # use prior year-end as the start where available
    rets = []
    prev_val = eq.iloc[0]
    for date, val in yearly.items():
        ret = (val / prev_val) - 1
        rets.append({"Year": date.year, "End Equity": val, "Return (%)": ret * 100})
        prev_val = val
    return pd.DataFrame(rets)
