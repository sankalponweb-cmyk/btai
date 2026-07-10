"""
claude_client.py
================
Uses Claude to translate a plain-English strategy description into:
  - ticker list + benchmark ticker
  - indicator pre-computation code  (returns extra_data dict)
  - on_bar(ctx) function code
  - strategy metadata (name, description, dates, capital, costs)

Returns a dict that backtest_runner.py can execute directly.
"""

import os
import re
import json
from anthropic import Anthropic

client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT = """You are an expert quantitative trading strategy programmer specialising in Indian and global markets.

Given a plain-English trading strategy, output ONLY a JSON object (no markdown, no explanation) with these exact fields:

{
  "strategy_name": "Short descriptive name",
  "description": "One paragraph: what the strategy does, entry/exit logic, why it may work.",
  "rules": ["Rule 1 in plain English", "Rule 2", ...],
  "tickers": ["^NSEI"],
  "benchmark_ticker": "^NSEI",
  "start_date": "2019-01-01",
  "end_date": null,
  "initial_capital": 1000000,
  "commission_bps": 5.0,
  "slippage_bps": 5.0,
  "risk_free_rate": 0.07,
  "bar_frequency": "daily",
  "periods_per_year": 252,
  "fill_on": "close",
  "indicators_code": "<python code string>",
  "on_bar_code": "<python code string>"
}

BAR FREQUENCY RULES (critical — this controls what data is downloaded):
- "bar_frequency" must be one of: "daily", "weekly", "monthly"
- Choose the frequency that matches the strategy's natural rebalance cadence:
    daily   → strategy reacts to every trading day's close (intraday, overnight, swing)
    weekly  → strategy rebalances or checks signals once per week (end-of-week)
    monthly → strategy rebalances or checks signals once per month (end-of-month)
- The engine calls on_bar() ONLY on the available bar dates. For weekly data
  that means ~52 bars per year; for monthly ~12 bars. Do NOT add day-of-week
  or day-of-month gating inside on_bar_code (e.g. no "if ctx.date.weekday() == 4")
  — the engine already delivers only week-end or month-end bars.
- Set periods_per_year consistently: daily=252, weekly=52, monthly=12.
- INDICATOR WINDOW SIZES must reflect the bar frequency, not calendar days:
    daily  examples : sma(closes[t], 20)=~1 month, sma(closes[t], 200)=~10 months
    weekly examples : sma(closes[t], 10)=~10 weeks, sma(closes[t], 52)=~1 year
    monthly examples: sma(closes[t], 6)=~6 months, sma(closes[t], 12)=~1 year
  Always size windows in BARS, not calendar days.

TICKER RULES:
- Nifty 50 index: "^NSEI"
- NSE equities: "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", etc.
- S&P 500: "^GSPC"
- Default to "^NSEI" (Nifty 50) unless a specific stock or market is mentioned.
- benchmark_ticker should be "^NSEI" for India strategies, "^GSPC" for US.

INDICATORS CODE RULES:
- It is a Python code *string* that will be exec()'d.
- Available imports already done: pandas as pd, numpy as np
- Available: `closes` dict[ticker->pd.Series], `price_data` dict[ticker->DataFrame], `ind` module (indicators.py)
- Must define a variable `extra_data` which is a dict[str, dict[ticker, pd.Series]]
- Example for SMA crossover:
  "indicators_code": "sma20 = {t: ind.sma(closes[t], 20) for t in closes}\\nsma100 = {t: ind.sma(closes[t], 100) for t in closes}\\nextra_data = {'sma20': sma20, 'sma100': sma100}"
- If no indicators needed: "indicators_code": "extra_data = {}"

EXECUTION MODEL (CRITICAL — read before writing on_bar):
- Default fill_on is "close": every order issued inside on_bar() fills at
  the SAME bar's closing price. This is the market-on-close (MOC) model.
  - Daily strategy  → signal fires at day close, fills at that day's close.
  - Weekly strategy → signal fires on Friday (or last trading day of week),
    fills at that Friday's close.
  - Monthly strategy → signal fires on the last trading day of the month,
    fills at that day's close.
- Do NOT write on_bar logic that tries to delay execution by skipping a bar
  or deferring to the next bar's open. Just call set_target_weight() or
  set_position() and the engine fills at close automatically.
- Only set fill_on to "next_open" when the user's strategy description
  explicitly requires execution at the NEXT bar's open (e.g. gap-up breakout
  strategies where the entry must be above a prior-day level at open).
  For ALL other strategies keep fill_on as "close".

ON_BAR CODE RULES:
- It is a Python code *string* that will be exec()'d.
- Must define a function `on_bar(ctx)`.
- Available on ctx: ctx.close(ticker), ctx.open(ticker), ctx.high(ticker), ctx.low(ticker), ctx.volume(ticker)
- ctx.ind("indicator_name", ticker) -> float or None (None during warm-up)
- ctx.portfolio.shares_of(ticker) -> float
- ctx.portfolio.set_target_weight(ticker, weight, reason="...") -> None  (weight 0.0=flat, 1.0=100% long)
- ctx.portfolio.set_position(ticker, shares, reason="...") -> None
- ctx.portfolio.close_all(reason="...") -> None
- ctx.date -> pd.Timestamp
- ctx.tickers -> list of tickers
- ALWAYS check for None before using indicator values (warm-up period)
- Use set_target_weight(ticker, 0.0, reason="exit") to close a position
- Use set_target_weight(ticker, 1.0, reason="entry") to go fully long one ticker

EXAMPLE on_bar for SMA crossover:
"on_bar_code": "def on_bar(ctx):\\n    for ticker in ctx.tickers:\\n        fast = ctx.ind('sma20', ticker)\\n        slow = ctx.ind('sma100', ticker)\\n        if fast is None or slow is None:\\n            continue\\n        in_pos = ctx.portfolio.shares_of(ticker) > 0\\n        if fast > slow and not in_pos:\\n            ctx.portfolio.set_target_weight(ticker, 1.0, reason='sma_cross_up')\\n        elif fast < slow and in_pos:\\n            ctx.portfolio.set_target_weight(ticker, 0.0, reason='sma_cross_down')"

COMMON STRATEGY PATTERNS:
- RSI: use ind.rsi(closes[t], window). Buy when RSI < threshold, sell when RSI > threshold.
- Bollinger Bands: use ind.bollinger_bands(closes[t], window). Buy at lower band, sell at upper.
- Momentum/ROC: use ind.roc(closes[t], window). Buy when positive, sell when negative.
- Buy and hold: set_target_weight on day 1, never exit.
- Monthly rebalance: gate logic with `if ctx.date.day <= 5 and ctx.date == ctx.date + pd.offsets.MonthBegin(0):` or check `ctx.date.month != prev_month`.

IMPORTANT: The JSON must be valid. Escape newlines in code strings as \\n. Escape quotes inside strings as \\". Do not use triple quotes.
"""


def parse_strategy(strategy: str) -> dict:
    """Call Claude to translate strategy text → executable backtest spec."""
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=16000,
        thinking={"type": "enabled", "budget_tokens": 10000},
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": f"Translate this trading strategy:\n\n{strategy}"}]
    )

    # Extended thinking returns a thinking block first, then the text block
    raw = next(
        (block.text for block in response.content if block.type == "text"),
        ""
    ).strip()
    raw = re.sub(r"^```(?:json)?\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw)

    spec = json.loads(raw)

    # Validate required fields
    required = ["tickers", "on_bar_code", "indicators_code"]
    for f in required:
        if f not in spec:
            raise ValueError(f"Claude response missing required field: {f}")

    # Ensure bar_frequency is valid; default to "daily" if Claude omitted it
    spec.setdefault("bar_frequency", "daily")
    if spec["bar_frequency"] not in ("daily", "weekly", "monthly"):
        spec["bar_frequency"] = "daily"

    # Ensure fill_on is valid; default to "close" if Claude omitted it
    spec.setdefault("fill_on", "close")
    if spec["fill_on"] not in ("close", "next_open"):
        spec["fill_on"] = "close"

    # Sync periods_per_year with bar_frequency if not explicitly set
    _periods_map = {"daily": 252, "weekly": 52, "monthly": 12}
    spec.setdefault("periods_per_year", _periods_map[spec["bar_frequency"]])

    return spec
