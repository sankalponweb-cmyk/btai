"""
indicators.py
=============
Common technical indicators used when translating a plain-English or
config-based strategy into signal-generation code.

All functions take and return pandas Series (or DataFrames where noted) and
are intentionally simple / dependency-free (pandas + numpy only) so they are
easy to read, audit, and tweak.

Convention: every indicator is *causal* (uses only data up to and including
the current row), so using these directly in a strategy will not introduce
look-ahead bias as long as the resulting signal is acted upon on the *next*
bar (handle that in the strategy script, not here).
"""

import numpy as np
import pandas as pd


def sma(series: pd.Series, window: int) -> pd.Series:
    """Simple moving average."""
    return series.rolling(window=window, min_periods=window).mean()


def ema(series: pd.Series, span: int) -> pd.Series:
    """Exponential moving average."""
    return series.ewm(span=span, adjust=False, min_periods=span).mean()


def roc(series: pd.Series, window: int) -> pd.Series:
    """Rate of change / momentum: percent change over `window` bars."""
    return series.pct_change(periods=window)


def returns(series: pd.Series, window: int = 1) -> pd.Series:
    """Simple percent returns over `window` bars (alias of roc)."""
    return series.pct_change(periods=window)


def volatility(series: pd.Series, window: int) -> pd.Series:
    """Rolling standard deviation of daily returns (not annualized)."""
    return series.pct_change().rolling(window=window, min_periods=window).std()


def rsi(series: pd.Series, window: int = 14) -> pd.Series:
    """Relative Strength Index (Wilder's smoothing)."""
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / window, min_periods=window, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / window, min_periods=window, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    out = 100 - (100 / (1 + rs))
    return out.fillna(100)  # avg_loss == 0 -> RSI = 100


def macd(series: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> pd.DataFrame:
    """MACD line, signal line, and histogram."""
    fast_ema = ema(series, fast)
    slow_ema = ema(series, slow)
    macd_line = fast_ema - slow_ema
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    hist = macd_line - signal_line
    return pd.DataFrame({"macd": macd_line, "signal": signal_line, "hist": hist})


def bollinger_bands(series: pd.Series, window: int = 20, num_std: float = 2.0) -> pd.DataFrame:
    """Bollinger Bands: middle (SMA), upper, lower."""
    mid = sma(series, window)
    std = series.rolling(window=window, min_periods=window).std()
    upper = mid + num_std * std
    lower = mid - num_std * std
    return pd.DataFrame({"mid": mid, "upper": upper, "lower": lower})


def atr(high: pd.Series, low: pd.Series, close: pd.Series, window: int = 14) -> pd.Series:
    """Average True Range (Wilder's smoothing) on whatever bar frequency
    the input series are (e.g. weekly closes for a weekly-ATR system)."""
    prev_close = close.shift(1)
    tr = pd.concat(
        [
            high - low,
            (high - prev_close).abs(),
            (low - prev_close).abs(),
        ],
        axis=1,
    ).max(axis=1)
    return tr.ewm(alpha=1 / window, min_periods=window, adjust=False).mean()


def rolling_max(series: pd.Series, window: int) -> pd.Series:
    """Rolling max — useful for breakout entries / trailing-stop highs."""
    return series.rolling(window=window, min_periods=window).max()


def rolling_min(series: pd.Series, window: int) -> pd.Series:
    """Rolling min — useful for breakout exits / trailing-stop lows."""
    return series.rolling(window=window, min_periods=window).min()


def cross_above(a: pd.Series, b: pd.Series) -> pd.Series:
    """True on the bar where series `a` crosses above series `b`."""
    return (a > b) & (a.shift(1) <= b.shift(1))


def cross_below(a: pd.Series, b: pd.Series) -> pd.Series:
    """True on the bar where series `a` crosses below series `b`."""
    return (a < b) & (a.shift(1) >= b.shift(1))


def cross_sectional_rank(frame: pd.DataFrame, ascending: bool = False) -> pd.DataFrame:
    """
    Rank each column against the others on each date (1 = best).
    Used for momentum/relative-strength rotation strategies:
        scores = roc(close_panel, 126)
        ranks = cross_sectional_rank(scores)
        top_n = ranks <= 5
    """
    return frame.rank(axis=1, ascending=ascending, method="first")


def resample_ohlc(df: pd.DataFrame, rule: str) -> pd.DataFrame:
    """
    Resample a daily OHLCV DataFrame to a lower frequency (e.g. 'W-FRI' for
    weekly bars ending Friday, 'M' for month-end). Useful for systems that
    operate on weekly closes (e.g. weekly ATR stops).
    """
    agg = {}
    for col in df.columns:
        cl = col.lower()
        if cl == "open":
            agg[col] = "first"
        elif cl == "high":
            agg[col] = "max"
        elif cl == "low":
            agg[col] = "min"
        elif cl in ("close", "adj close"):
            agg[col] = "last"
        elif cl == "volume":
            agg[col] = "sum"
        else:
            agg[col] = "last"
    return df.resample(rule).agg(agg).dropna(how="all")
