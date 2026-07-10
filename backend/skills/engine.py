"""
engine.py
=========
Generic, event-driven backtest engine.

Design goals
------------
- Works for a single instrument OR a basket (rotation / portfolio strategies)
  with the same API.
- The strategy author writes one function, `on_bar(ctx)`, called once per
  trading day in chronological order. Inside it you read prices and any
  precomputed indicators via `ctx`, then issue orders via `ctx.portfolio`.
- Because indicators are precomputed once (vectorized, causal) and passed in
  via `extra_data`, `on_bar` itself can stay simple even for complex rules
  (ATR trailing stops, cross-sectional momentum ranks, regime filters, etc.)
  -- it just reads the precomputed value for "today".
- The engine takes care of: cash/position accounting, commissions &
  slippage, marking the portfolio to market every day (so the equity curve
  has no gaps even on days a strategy does nothing), and building a
  round-trip trade log (entry date/price, exit date/price, P&L, holding
  period, etc.) -- including correctly handling partial scale-ins/outs.

Typical usage
-------------
    import pandas as pd
    from engine import Portfolio, run_backtest

    def on_bar(ctx):
        for ticker in ctx.tickers:
            fast = ctx.ind("sma_fast", ticker)
            slow = ctx.ind("sma_slow", ticker)
            if fast is None or slow is None:
                continue
            in_position = ctx.portfolio.shares_of(ticker) > 0
            if fast > slow and not in_position:
                ctx.portfolio.set_target_weight(ticker, 1.0 / len(ctx.tickers))
            elif fast < slow and in_position:
                ctx.portfolio.set_target_weight(ticker, 0.0)

    result = run_backtest(
        price_data=price_data,                # dict[ticker -> OHLCV DataFrame]
        on_bar=on_bar,
        initial_capital=1_000_000,
        extra_data={"sma_fast": sma_fast_df, "sma_slow": sma_slow_df},
    )
"""

from dataclasses import dataclass, field

import numpy as np
import pandas as pd


# --------------------------------------------------------------------------- #
# Portfolio: cash + position accounting, order execution, trade-log building
# --------------------------------------------------------------------------- #
class Portfolio:
    def __init__(self, initial_capital: float, commission_bps: float = 0.0,
                 slippage_bps: float = 0.0):
        self.cash = float(initial_capital)
        self.initial_capital = float(initial_capital)
        self.commission_bps = commission_bps
        self.slippage_bps = slippage_bps

        # ticker -> current share count (can be negative for shorts)
        self.shares: dict[str, float] = {}
        # ticker -> dict describing the currently-open trade (or absent if flat)
        self._open: dict[str, dict] = {}
        # completed round-trip (or partial) trades
        self.trade_log: list[dict] = []
        # every individual fill, for auditing
        self.orders: list[dict] = []

        # filled in by the engine before each on_bar call
        self.date = None
        self._prices: dict[str, float] = {}

    # -- helpers -------------------------------------------------------- #
    def shares_of(self, ticker: str) -> float:
        return self.shares.get(ticker, 0.0)

    def value(self) -> float:
        """Mark-to-market portfolio value using the prices set for the
        current bar (engine sets these before calling on_bar)."""
        mv = self.cash
        for ticker, sh in self.shares.items():
            px = self._prices.get(ticker)
            if px is not None and not (isinstance(px, float) and np.isnan(px)):
                mv += sh * px
        return mv

    def exposure(self) -> float:
        """Fraction of portfolio value currently invested (gross)."""
        total = self.value()
        if total <= 0:
            return 0.0
        invested = sum(
            abs(sh * self._prices.get(t, 0.0)) for t, sh in self.shares.items()
        )
        return invested / total

    # -- order execution -------------------------------------------------- #
    def _fill_price(self, ticker: str, side: str) -> float:
        px = self._prices[ticker]
        slip = px * (self.slippage_bps / 10000.0)
        return px + slip if side == "buy" else px - slip

    def set_position(self, ticker: str, target_shares: float, reason: str = ""):
        """Move the position in `ticker` to exactly `target_shares`,
        recording fills, commissions, and (on full/partial exits) trade-log
        entries. `target_shares` may be 0 (flat), positive (long) or
        negative (short)."""
        target_shares = float(target_shares)
        current = self.shares_of(ticker)
        delta = target_shares - current

        if abs(delta) < 1e-9 or ticker not in self._prices:
            return  # nothing to do / no price available today

        side = "buy" if delta > 0 else "sell"
        fill_px = self._fill_price(ticker, side)
        commission = abs(delta) * fill_px * (self.commission_bps / 10000.0)

        self.cash -= delta * fill_px  # buying spends cash (delta>0), selling adds it
        self.cash -= commission

        self.orders.append({
            "date": self.date, "ticker": ticker, "side": side,
            "shares": abs(delta), "price": fill_px, "commission": commission,
            "reason": reason,
        })

        self._update_trade_log(ticker, current, target_shares, fill_px, commission, reason)
        self.shares[ticker] = target_shares
        if abs(target_shares) < 1e-9:
            self.shares.pop(ticker, None)

    def set_target_weight(self, ticker: str, weight: float, reason: str = ""):
        """Convenience wrapper: size the position so its value is
        `weight * current portfolio value` (weight may be negative for
        shorts, e.g. -0.1 = 10% of equity short)."""
        if ticker not in self._prices:
            return
        target_value = self.value() * weight
        target_shares = target_value / self._prices[ticker]
        self.set_position(ticker, target_shares, reason=reason)

    def close_all(self, reason: str = "close_all"):
        for ticker in list(self.shares.keys()):
            self.set_position(ticker, 0.0, reason=reason)

    # -- internal: trade-log bookkeeping ---------------------------------- #
    def _update_trade_log(self, ticker, prev_shares, new_shares, fill_px, commission, reason):
        prev_sign = np.sign(prev_shares)
        new_sign = np.sign(new_shares)

        if prev_sign == 0 and new_sign != 0:
            # opening a fresh position
            self._open[ticker] = {
                "entry_date": self.date, "entry_price": fill_px,
                "side": "long" if new_sign > 0 else "short",
                "shares": abs(new_shares), "entry_commission": commission,
            }
            return

        if prev_sign != 0 and new_sign == 0:
            # full exit
            self._close_trade(ticker, abs(prev_shares), fill_px, commission, reason)
            self._open.pop(ticker, None)
            return

        if prev_sign != 0 and new_sign != 0 and prev_sign != new_sign:
            # flip: close the old side entirely, open the new side
            self._close_trade(ticker, abs(prev_shares), fill_px, commission, reason)
            self._open[ticker] = {
                "entry_date": self.date, "entry_price": fill_px,
                "side": "long" if new_sign > 0 else "short",
                "shares": abs(new_shares), "entry_commission": 0.0,
            }
            return

        # same direction, size changed
        if abs(new_shares) > abs(prev_shares):
            # scaling in: blend entry price (weighted average), keep entry date
            open_trade = self._open.get(ticker)
            if open_trade is None:
                self._open[ticker] = {
                    "entry_date": self.date, "entry_price": fill_px,
                    "side": "long" if new_sign > 0 else "short",
                    "shares": abs(new_shares), "entry_commission": commission,
                }
            else:
                old_sh, old_px = open_trade["shares"], open_trade["entry_price"]
                add_sh = abs(new_shares) - old_sh
                blended = (old_sh * old_px + add_sh * fill_px) / (old_sh + add_sh)
                open_trade["entry_price"] = blended
                open_trade["shares"] = abs(new_shares)
                open_trade["entry_commission"] = open_trade.get("entry_commission", 0) + commission
        else:
            # scaling out (partial exit) -- log the realized portion
            exited_shares = abs(prev_shares) - abs(new_shares)
            self._close_trade(ticker, exited_shares, fill_px, commission, reason, partial=True)
            open_trade = self._open.get(ticker)
            if open_trade is not None:
                open_trade["shares"] = abs(new_shares)

    def _close_trade(self, ticker, exit_shares, exit_px, commission, reason, partial=False):
        open_trade = self._open.get(ticker)
        if open_trade is None:
            return
        entry_px = open_trade["entry_price"]
        side = open_trade["side"]
        if side == "long":
            pnl = (exit_px - entry_px) * exit_shares
            ret_pct = (exit_px / entry_px) - 1
        else:
            pnl = (entry_px - exit_px) * exit_shares
            ret_pct = (entry_px / exit_px) - 1
        entry_comm_share = open_trade.get("entry_commission", 0.0) * (
            exit_shares / open_trade["shares"] if open_trade["shares"] else 1
        )
        pnl_net = pnl - commission - entry_comm_share
        holding_days = (self.date - open_trade["entry_date"]).days
        self.trade_log.append({
            "ticker": ticker, "side": side,
            "entry_date": open_trade["entry_date"], "entry_price": entry_px,
            "exit_date": self.date, "exit_price": exit_px,
            "shares": exit_shares, "holding_days": holding_days,
            "pnl": pnl_net, "return_pct": ret_pct,
            "exit_reason": reason, "partial": partial,
        })


# --------------------------------------------------------------------------- #
# Context object passed to on_bar each day
# --------------------------------------------------------------------------- #
class BarContext:
    def __init__(self, date, prices: dict, extra_data: dict, portfolio: Portfolio,
                 tickers: list):
        self.date = date
        self._prices = prices  # ticker -> dict(open/high/low/close/volume)
        self._extra = extra_data  # name -> {ticker -> Series}, precomputed lookups
        self.portfolio = portfolio
        self.tickers = tickers

    def close(self, ticker):
        return self._price_field(ticker, "close")

    def open(self, ticker):
        return self._price_field(ticker, "open")

    def high(self, ticker):
        return self._price_field(ticker, "high")

    def low(self, ticker):
        return self._price_field(ticker, "low")

    def volume(self, ticker):
        return self._price_field(ticker, "volume")

    def _price_field(self, ticker, field_name):
        d = self._prices.get(ticker)
        if d is None:
            return None
        v = d.get(field_name)
        if v is None or (isinstance(v, float) and np.isnan(v)):
            return None
        return v

    def ind(self, name, ticker):
        """Look up a precomputed indicator value for `ticker` as of
        `self.date`. Returns None if unavailable (e.g. warm-up period)."""
        series = self._extra.get(name, {}).get(ticker)
        if series is None or self.date not in series.index:
            return None
        v = series.loc[self.date]
        if isinstance(v, float) and np.isnan(v):
            return None
        return v


# --------------------------------------------------------------------------- #
# Result container
# --------------------------------------------------------------------------- #
@dataclass
class BacktestResult:
    equity_curve: pd.Series
    drawdown: pd.Series
    cash_curve: pd.Series
    exposure: pd.Series
    trade_log: pd.DataFrame
    orders: pd.DataFrame
    positions: pd.DataFrame
    benchmark_curve: object = None
    meta: dict = field(default_factory=dict)


# --------------------------------------------------------------------------- #
# Main loop
# --------------------------------------------------------------------------- #
def run_backtest(
    price_data,
    on_bar,
    initial_capital: float = 1_000_000,
    start=None,
    end=None,
    commission_bps: float = 5.0,
    slippage_bps: float = 5.0,
    extra_data=None,
    benchmark=None,
    fill_on: str = "close",
):
    """
    price_data: dict[ticker -> DataFrame] with columns Open/High/Low/Close/Volume
                (column names are matched case-insensitively).
    on_bar:     callable(ctx: BarContext) -> None. Issue orders via
                ctx.portfolio.set_position / set_target_weight.
    extra_data: dict[indicator_name -> dict[ticker -> pd.Series indexed by date]]
                Precompute these with indicators.py before calling.
    benchmark:  optional pd.Series of benchmark close prices (e.g. an index),
                used to plot a normalized buy-and-hold comparison line.
    fill_on:    "close"     – orders issued inside on_bar() fill at the same
                              bar's close price (default, market-on-close model).
                              Signals generated on daily close fill at daily
                              close; signals on weekly close fill at weekly
                              close — whichever bar on_bar fired on.
                "next_open" – orders queue during on_bar() and fill at the
                              *next* bar's open price (traditional next-bar
                              execution to eliminate same-bar look-ahead).
    """
    if fill_on not in ("close", "next_open"):
        raise ValueError(f"fill_on must be 'close' or 'next_open', got {fill_on!r}")

    extra_data = extra_data or {}
    tickers = list(price_data.keys())

    # normalize column names and build a unified trading calendar
    normalized = {}
    for t, df in price_data.items():
        d = df.copy()
        d.columns = [str(c).strip().lower() for c in d.columns]
        d.index = pd.to_datetime(d.index)
        normalized[t] = d

    all_dates = sorted(set().union(*[set(d.index) for d in normalized.values()]))
    if start:
        all_dates = [d for d in all_dates if d >= pd.Timestamp(start)]
    if end:
        all_dates = [d for d in all_dates if d <= pd.Timestamp(end)]

    portfolio = Portfolio(initial_capital, commission_bps, slippage_bps)

    equity_records, cash_records, exposure_records = [], [], []
    positions_records = []

    # For fill_on="next_open": orders queued in on_bar() fill at the next
    # bar's open.  We store (ticker, target_shares, reason) tuples here and
    # execute them at the top of the following iteration.
    _pending_orders: list[tuple] = []

    for i, date in enumerate(all_dates):
        prices_today = {}
        for t in tickers:
            d = normalized[t]
            if date in d.index:
                row = d.loc[date]
                prices_today[t] = {
                    "open": row.get("open", np.nan),
                    "high": row.get("high", np.nan),
                    "low": row.get("low", np.nan),
                    "close": row.get("close", np.nan),
                    "volume": row.get("volume", np.nan),
                }

        # carry forward the last known close for tickers with no bar today
        # so mark-to-market doesn't drop to zero on holidays/missing data
        for t in tickers:
            if t not in prices_today or (
                isinstance(prices_today[t]["close"], float) and np.isnan(prices_today[t]["close"])
            ):
                last_close = portfolio._prices.get(t)
                if last_close is not None:
                    entry = prices_today.setdefault(t, {})
                    entry["close"] = last_close
                    entry.setdefault("open", last_close)
                    entry.setdefault("high", last_close)
                    entry.setdefault("low", last_close)
                    entry.setdefault("volume", np.nan)

        # ── fill_on="next_open": flush pending orders at today's open ──────
        if fill_on == "next_open" and _pending_orders:
            portfolio.date = date
            portfolio._prices = {t: v.get("open", v["close"])
                                  for t, v in prices_today.items()
                                  if not (isinstance(v.get("open", np.nan), float)
                                          and np.isnan(v.get("open", np.nan)))}
            for _ticker, _target_shares, _reason in _pending_orders:
                portfolio.set_position(_ticker, _target_shares, reason=_reason)
            _pending_orders.clear()

        # ── set portfolio prices to CLOSE for signal evaluation ────────────
        # This is the "market-on-close" execution model: on_bar() sees today's
        # close price and any orders issued inside on_bar() fill at that same
        # close price (fill_on="close") or are queued for next bar's open
        # (fill_on="next_open").
        portfolio.date = date
        portfolio._prices = {t: v["close"] for t, v in prices_today.items()}

        if fill_on == "close":
            # Orders fill immediately at the current bar's close price.
            ctx = BarContext(date, prices_today, extra_data, portfolio, tickers)
            on_bar(ctx)
        else:
            # fill_on="next_open": intercept set_position / set_target_weight
            # calls so that instead of filling immediately they queue a
            # pending order to execute at the next bar's open.
            class _QueuingPortfolio:
                """Thin proxy that queues orders instead of filling them."""
                def __init__(self, real_portfolio):
                    self._p = real_portfolio

                def shares_of(self, ticker):
                    return self._p.shares_of(ticker)

                def set_position(self, ticker, target_shares, reason=""):
                    _pending_orders.append((ticker, float(target_shares), reason))

                def set_target_weight(self, ticker, weight, reason=""):
                    if ticker not in self._p._prices:
                        return
                    target_value = self._p.value() * weight
                    target_shares = target_value / self._p._prices[ticker]
                    _pending_orders.append((ticker, float(target_shares), reason))

                def close_all(self, reason="close_all"):
                    for ticker in list(self._p.shares.keys()):
                        _pending_orders.append((ticker, 0.0, reason))

                # pass-through date/tickers so on_bar code can read them
                @property
                def date(self):
                    return self._p.date

            proxy_portfolio = _QueuingPortfolio(portfolio)
            ctx = BarContext(date, prices_today, extra_data, proxy_portfolio, tickers)
            on_bar(ctx)

        # ensure mark-to-market always uses the bar's close after any fills
        portfolio._prices = {t: v["close"] for t, v in prices_today.items()}

        equity_records.append((date, portfolio.value()))
        cash_records.append((date, portfolio.cash))
        exposure_records.append((date, portfolio.exposure()))
        positions_records.append({"date": date, **portfolio.shares})

    equity_curve = pd.Series(dict(equity_records)).sort_index()
    cash_curve = pd.Series(dict(cash_records)).sort_index()
    exposure_series = pd.Series(dict(exposure_records)).sort_index()

    running_max = equity_curve.cummax()
    drawdown = (equity_curve - running_max) / running_max

    positions_df = pd.DataFrame(positions_records).set_index("date").fillna(0.0) \
        if positions_records else pd.DataFrame()

    trade_log_df = pd.DataFrame(portfolio.trade_log)
    orders_df = pd.DataFrame(portfolio.orders)

    benchmark_curve = None
    if benchmark is not None:
        b = benchmark.copy()
        b.index = pd.to_datetime(b.index)
        b = b.reindex(equity_curve.index, method="ffill").dropna()
        if len(b) > 0:
            benchmark_curve = b / b.iloc[0] * initial_capital

    return BacktestResult(
        equity_curve=equity_curve,
        drawdown=drawdown,
        cash_curve=cash_curve,
        exposure=exposure_series,
        trade_log=trade_log_df,
        orders=orders_df,
        positions=positions_df,
        benchmark_curve=benchmark_curve,
        meta={"initial_capital": initial_capital, "tickers": tickers},
    )
