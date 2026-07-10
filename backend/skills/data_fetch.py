"""
data_fetch.py
=============
Thin wrapper around yfinance for downloading historical OHLCV data for one
or more tickers, with on-disk caching (so repeated runs / iteration during
strategy development don't re-hit the network) and basic cleaning.

NETWORK NOTE: yfinance talks to query1/query2.finance.yahoo.com. If you're
running in a sandbox with an egress allowlist, make sure those hosts (and
generally *.finance.yahoo.com) are reachable. If a download silently returns
an empty frame, that's almost always the cause -- this module will raise a
clear error in that case rather than letting a strategy run on no data.

Usage
-----
    from data_fetch import fetch_prices

    price_data = fetch_prices(
        tickers=["RELIANCE.NS", "TCS.NS", "^NSEI"],
        start="2018-01-01",
        end="2025-12-31",
        cache_dir="./data_cache",
    )
    # price_data is dict[ticker -> DataFrame[Open, High, Low, Close, Volume]]
"""

import os
import time

import pandas as pd


def fetch_prices(tickers, start, end=None, cache_dir="./data_cache",
                  interval="1d", max_retries=3, retry_delay=2,
                  auto_adjust=True):
    """
    Download OHLCV data for a list of tickers via yfinance.

    Parameters
    ----------
    tickers : list[str]
        Yahoo Finance ticker symbols. Indian equities use the `.NS` (NSE) or
        `.BO` (BSE) suffix, e.g. "RELIANCE.NS". Indices use `^`, e.g.
        "^NSEI" (Nifty 50), "^GSPC" (S&P 500).
    start, end : str ("YYYY-MM-DD") or None
        Date range. `end=None` means up to the most recent available data.
    cache_dir : str
        Directory for parquet caches, keyed by ticker+interval+date range.
        Pass `cache_dir=None` to disable caching.
    interval : str
        yfinance interval string: "1d", "1wk", "1mo", etc.
    auto_adjust : bool
        If True (default), OHLC are adjusted for splits/dividends and the
        'Adj Close' column is folded into 'Close'. This is almost always
        what you want for backtesting.

    Returns
    -------
    dict[str, pd.DataFrame]
        Ticker -> DataFrame indexed by date with columns
        ['Open', 'High', 'Low', 'Close', 'Volume']. Tickers that failed to
        download are omitted, and a warning is printed.

    Raises
    ------
    RuntimeError if *no* tickers could be downloaded at all (likely a
    network/connectivity issue -- see module docstring).
    """
    import yfinance as yf

    if isinstance(tickers, str):
        tickers = [tickers]

    if cache_dir:
        os.makedirs(cache_dir, exist_ok=True)

    end_label = end or "latest"
    out = {}
    failed = []

    for ticker in tickers:
        cache_path = None
        if cache_dir:
            safe_name = ticker.replace("^", "IDX_").replace("/", "_")
            cache_path = os.path.join(
                cache_dir, f"{safe_name}_{interval}_{start}_{end_label}.parquet"
            )
            if os.path.exists(cache_path):
                try:
                    df = pd.read_parquet(cache_path)
                    out[ticker] = df
                    continue
                except Exception:
                    pass  # fall through to re-download if cache is corrupt

        df = None
        last_err = None
        for attempt in range(max_retries):
            try:
                df = yf.download(
                    ticker, start=start, end=end, interval=interval,
                    auto_adjust=auto_adjust, progress=False,
                )
                if df is not None and not df.empty:
                    break
            except Exception as e:
                last_err = e
            time.sleep(retry_delay)

        if df is None or df.empty:
            print(f"[data_fetch] WARNING: no data returned for '{ticker}'"
                  + (f" ({last_err})" if last_err else ""))
            failed.append(ticker)
            continue

        df = _clean_ohlcv(df, ticker)
        out[ticker] = df

        if cache_path:
            try:
                df.to_parquet(cache_path)
            except Exception:
                pass  # caching is best-effort

    if not out:
        raise RuntimeError(
            "fetch_prices: could not download data for ANY ticker "
            f"({tickers}). This usually means Yahoo Finance is unreachable "
            "from this environment (check network/egress settings for "
            "query1.finance.yahoo.com / query2.finance.yahoo.com), or the "
            "ticker symbols are invalid."
        )

    if failed:
        print(f"[data_fetch] Skipped {len(failed)} ticker(s) with no data: {failed}")

    return out


def _clean_ohlcv(df, ticker):
    """Flatten yfinance's (possibly MultiIndex) columns to a simple
    Open/High/Low/Close/Volume frame, drop NaT/duplicate index entries, and
    sort by date."""
    if isinstance(df.columns, pd.MultiIndex):
        # yfinance >= 0.2 returns columns like ('Close', 'RELIANCE.NS')
        df = df.copy()
        df.columns = [c[0] for c in df.columns]

    keep = [c for c in ["Open", "High", "Low", "Close", "Volume"] if c in df.columns]
    df = df[keep].copy()

    df.index = pd.to_datetime(df.index)
    df = df[~df.index.duplicated(keep="last")]
    df = df.sort_index()
    df = df.dropna(how="all")
    return df


def fetch_benchmark(ticker, start, end=None, cache_dir="./data_cache"):
    """Convenience helper: fetch a single benchmark series (close prices
    only) for comparison on the equity/drawdown chart, e.g.
    fetch_benchmark('^NSEI', start='2018-01-01')."""
    data = fetch_prices([ticker], start=start, end=end, cache_dir=cache_dir)
    df = data[ticker]
    return df["Close"]
