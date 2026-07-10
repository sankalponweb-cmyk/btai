"""
data_cleaner.py
===============
Detects and auto-corrects data anomalies in OHLCV DataFrames from yfinance
before they reach the backtest engine.

Detection methods
-----------------
Returns-based outliers      : Modified Z-score using rolling MAD (Median
                              Absolute Deviation).  More robust than Z-score or
                              a hard % threshold because it adapts to the
                              instrument's own volatility regime and is not
                              swayed by fat tails / kurtosis in equity returns.
                              Threshold: |modified_z| > MAD_THRESHOLD (default 5).

Absolute price level check  : If a single bar's Close deviates from the 21-day
                              rolling median by more than PRICE_LEVEL_FACTOR×,
                              it is almost certainly a misplaced decimal or an
                              extra/missing zero rather than a real move.

Intraday H/L ratio check    : High/Low > HL_RATIO_MAX within a single bar is
                              physically implausible for liquid markets and
                              flags a corrupted bar.

Corrections applied
-------------------
Detected bad bars           : NaN'd then linearly interpolated between the last
                              valid price before and the first valid price after
                              (preserves trend direction, unlike median
                              replacement which always pulls toward the median).

OHLC consistency            : H clipped up to max(O,C); L clipped down to
                              min(O,C).  Applied *after* interpolation so that
                              fixed bars are internally consistent.

Missing / negative OHLC     : Zero/negative → NaN → ffill → bfill.

NaN gaps                    : ffill (carry last known price) then bfill for
                              leading NaNs.

Volume anomalies            : Negative → clip to 0.  Extreme spikes
                              (>VOLUME_SPIKE_FACTOR × rolling median) set to
                              rolling median (volume spikes can distort
                              volume-weighted indicators).

Stale / frozen prices       : Runs of ≥ STALE_RUN_DAYS identical Close values
                              are warned about but not corrected — illiquid
                              instruments legitimately trade flat for days.

Structural issues
-----------------
Non-monotonic timestamps    : Sort ascending.
Duplicate dates             : Keep last row.
Entirely empty columns      : Drop.
"""

import sys
import numpy as np
import pandas as pd

# ── Tuning constants ──────────────────────────────────────────────────────────

ROLLING_WINDOW      = 21       # bars used to estimate local statistics
MAD_THRESHOLD       = 5.0      # modified z-score threshold for return outliers
                               # (standard for fat-tailed financial data; 3σ is
                               # too aggressive and flags genuine large moves)
PRICE_LEVEL_FACTOR  = 8.0      # Close > N × rolling_median → data error
HL_RATIO_MAX        = 3.0      # High/Low within one bar; > 3× is implausible
VOLUME_SPIKE_FACTOR = 50       # volume > N × rolling_median → data error

# Per-frequency defaults (caller overrides via parameters)
_DEFAULT_STALE_RUN_BARS = 8    # identical Close for N consecutive bars → warn
_DEFAULT_GAP_DAYS       = 7    # calendar-day gap above which we warn


# ── Helpers ───────────────────────────────────────────────────────────────────

def _rolling_mad(series: pd.Series, window: int) -> pd.Series:
    """Rolling Median Absolute Deviation (MAD), same window as rolling median."""
    roll_med = series.rolling(window, center=True, min_periods=max(3, window // 4)).median()
    return (series - roll_med).abs().rolling(window, center=True, min_periods=max(3, window // 4)).median()


def _modified_z(series: pd.Series, window: int) -> pd.Series:
    """
    Modified Z-score = 0.6745 × (x − rolling_median) / rolling_MAD
    Values with |score| > MAD_THRESHOLD are statistical outliers.
    0.6745 is the consistency factor for a normal distribution so that
    modified-z ≈ z for Gaussian data, while being far more robust for fat tails.
    """
    roll_med = series.rolling(window, center=True, min_periods=max(3, window // 4)).median()
    roll_mad = _rolling_mad(series, window)
    # Avoid division by zero for flat stretches
    denom = roll_mad.replace(0, np.nan)
    return 0.6745 * (series - roll_med) / denom


def _interpolate_bad(series: pd.Series, bad_mask: pd.Series) -> pd.Series:
    """
    Set bad positions to NaN and linearly interpolate.
    Falls back to forward-fill / backward-fill at the edges where
    interpolation cannot extrapolate.
    """
    s = series.copy()
    s[bad_mask] = np.nan
    s = s.interpolate(method="linear", limit_direction="both")
    s = s.ffill().bfill()
    return s


# ── Main entry point ──────────────────────────────────────────────────────────

def clean_price_data(
    price_data: dict,
    gap_days: int = _DEFAULT_GAP_DAYS,
    stale_run_bars: int = _DEFAULT_STALE_RUN_BARS,
) -> tuple:
    """
    Parameters
    ----------
    price_data : dict[ticker -> pd.DataFrame]
        Raw OHLCV DataFrames from yfinance.
    gap_days : int
        Calendar-day threshold above which a gap in the date index is flagged.
        Should match the bar frequency: ~7 for daily, ~14 for weekly, ~45
        for monthly.
    stale_run_bars : int
        Number of consecutive bars with an identical Close value that triggers
        a stale-data warning. Caller should set this based on the bar
        frequency: 8 for daily, 3 for weekly, 2 for monthly.

    Returns
    -------
    (cleaned_price_data, anomaly_messages)
        cleaned_price_data : corrected copies of each DataFrame
        anomaly_messages   : human-readable list for the frontend
    """
    cleaned  = {}
    messages = []

    for ticker, df in price_data.items():
        df   = df.copy()
        msgs = []

        # ── 1. Sort and deduplicate index ─────────────────────────────────
        if not df.index.is_monotonic_increasing:
            df = df.sort_index()
            msgs.append("reordered non-monotonic timestamps")

        n_dupes = int(df.index.duplicated().sum())
        if n_dupes:
            df = df[~df.index.duplicated(keep="last")]
            msgs.append(f"dropped {n_dupes} duplicate date(s)")

        # ── 2. Drop entirely-empty columns ────────────────────────────────
        empty_cols = [c for c in df.columns if df[c].isna().all()]
        if empty_cols:
            df.drop(columns=empty_cols, inplace=True)
            msgs.append(f"removed empty column(s): {empty_cols}")

        ohlc_cols = [c for c in ("Open", "High", "Low", "Close") if c in df.columns]

        # ── 3. Zero / negative OHLC → NaN ────────────────────────────────
        for col in ohlc_cols:
            bad = (df[col] <= 0) | df[col].isna()
            n   = int(bad.sum())
            if n:
                df.loc[bad, col] = np.nan
                msgs.append(f"{col}: nulled {n} non-positive value(s)")

        # ── 4. Forward-fill / backward-fill OHLC NaNs ────────────────────
        for col in ohlc_cols:
            n_nan = int(df[col].isna().sum())
            if n_nan:
                df[col] = df[col].ffill().bfill()
                filled = n_nan - int(df[col].isna().sum())
                if filled:
                    msgs.append(f"{col}: filled {filled} NaN gap(s) via ffill/bfill")

        # ── 5. Absolute price level check ─────────────────────────────────
        # A Close that is wildly out of line with recent history is a data
        # error (misplaced decimal, extra zero, corrupted API response).
        if "Close" in df.columns and len(df) >= ROLLING_WINDOW:
            roll_med = df["Close"].rolling(
                ROLLING_WINDOW, center=True, min_periods=max(3, ROLLING_WINDOW // 4)
            ).median()
            ratio = df["Close"] / roll_med.replace(0, np.nan)
            bad_level = (ratio > PRICE_LEVEL_FACTOR) | (ratio < 1.0 / PRICE_LEVEL_FACTOR)
            n_bad = int(bad_level.sum())
            if n_bad:
                # Interpolate all four OHLC cols together
                for col in ohlc_cols:
                    df[col] = _interpolate_bad(df[col], bad_level)
                msgs.append(
                    f"Close: corrected {n_bad} price level error(s) "
                    f"(>{PRICE_LEVEL_FACTOR}× or <1/{PRICE_LEVEL_FACTOR}× rolling median) "
                    "via linear interpolation"
                )

        # ── 6. MAD-based return outlier detection ─────────────────────────
        # Uses log returns (more stationary than simple returns) and a
        # rolling Modified Z-score which adapts to local volatility.
        if "Close" in df.columns and len(df) >= ROLLING_WINDOW:
            log_ret = np.log(df["Close"] / df["Close"].shift(1))
            mod_z   = _modified_z(log_ret, ROLLING_WINDOW).abs()

            # An outlier that is immediately reversed (spike-and-revert) is
            # almost certainly a data error; a sustained move is real.
            next_ret = log_ret.shift(-1)
            spike_and_revert = (mod_z > MAD_THRESHOLD) & (log_ret * next_ret < 0) & \
                               (_modified_z(next_ret, ROLLING_WINDOW).abs() > MAD_THRESHOLD * 0.6)

            n_spikes = int(spike_and_revert.sum())
            if n_spikes:
                for col in ohlc_cols:
                    df[col] = _interpolate_bad(df[col], spike_and_revert)
                msgs.append(
                    f"Close: corrected {n_spikes} spike-and-revert outlier(s) "
                    f"(modified Z > {MAD_THRESHOLD}, immediately reversed) "
                    "via linear interpolation"
                )

            # Isolated single-bar extreme spikes (not revert-confirmed) — warn only
            isolated_spikes = (mod_z > MAD_THRESHOLD * 1.5) & ~spike_and_revert
            n_iso = int(isolated_spikes.sum())
            if n_iso:
                msgs.append(
                    f"Close: {n_iso} large return(s) detected (modified Z > "
                    f"{MAD_THRESHOLD*1.5:.1f}) — kept as likely real events "
                    "(earnings, macro shock, circuit breaker)"
                )

        # ── 7. Intraday High/Low ratio check ─────────────────────────────
        # High/Low > HL_RATIO_MAX in a single bar is physically implausible
        # for any liquid market and signals a corrupted bar.
        if "High" in df.columns and "Low" in df.columns:
            valid_low  = df["Low"].replace(0, np.nan)
            hl_ratio   = df["High"] / valid_low
            bad_hl     = hl_ratio > HL_RATIO_MAX
            n_bad_hl   = int(bad_hl.sum())
            if n_bad_hl:
                for col in ohlc_cols:
                    df[col] = _interpolate_bad(df[col], bad_hl)
                msgs.append(
                    f"OHLC: corrected {n_bad_hl} bar(s) with High/Low ratio "
                    f"> {HL_RATIO_MAX}× (corrupted bar) via interpolation"
                )

        # ── 8. OHLC internal consistency ─────────────────────────────────
        # Applied after all corrections so fixed bars are consistent.
        if all(c in df.columns for c in ("Open", "High", "Low", "Close")):
            true_high = df[["Open", "Close"]].max(axis=1)
            bad_high  = df["High"] < true_high
            n_h       = int(bad_high.sum())
            if n_h:
                df.loc[bad_high, "High"] = true_high[bad_high]
                msgs.append(f"High: raised {n_h} bar(s) to max(Open,Close)")

            true_low = df[["Open", "Close"]].min(axis=1)
            bad_low  = df["Low"] > true_low
            n_l      = int(bad_low.sum())
            if n_l:
                df.loc[bad_low, "Low"] = true_low[bad_low]
                msgs.append(f"Low: lowered {n_l} bar(s) to min(Open,Close)")

        # ── 9. Volume anomalies ───────────────────────────────────────────
        if "Volume" in df.columns:
            # Negative volume → 0
            n_neg = int((df["Volume"] < 0).sum())
            if n_neg:
                df["Volume"] = df["Volume"].clip(lower=0)
                msgs.append(f"Volume: clipped {n_neg} negative value(s) to 0")

            # Extreme volume spikes → rolling median
            vol = df["Volume"].replace(0, np.nan)
            if vol.notna().sum() >= ROLLING_WINDOW:
                roll_vol_med = vol.rolling(
                    ROLLING_WINDOW, center=True, min_periods=5
                ).median().replace(0, np.nan)
                vol_ratio  = vol / roll_vol_med
                bad_vol    = vol_ratio > VOLUME_SPIKE_FACTOR
                n_bad_vol  = int(bad_vol.sum())
                if n_bad_vol:
                    df.loc[bad_vol, "Volume"] = roll_vol_med[bad_vol]
                    msgs.append(
                        f"Volume: capped {n_bad_vol} extreme spike(s) "
                        f"(>{VOLUME_SPIKE_FACTOR}× rolling median) to rolling median"
                    )

            df["Volume"] = df["Volume"].fillna(0)

        # ── 10. Stale price run detection (warn only) ─────────────────────
        if "Close" in df.columns and len(df) > stale_run_bars:
            is_flat    = df["Close"].diff().abs() < 1e-9
            run_ids    = (~is_flat).cumsum()
            run_lens   = is_flat.groupby(run_ids).transform("sum")
            max_run    = int(run_lens.max())
            if max_run >= stale_run_bars:
                longest_start = run_lens[run_lens == max_run].index[0]
                msgs.append(
                    f"WARN: {max_run}-bar stale/frozen Close run starting "
                    f"{str(longest_start)[:10]} — possible missing data "
                    "(not auto-corrected; may be legitimate for illiquid instruments)"
                )

        # ── 11. Large data gap detection ──────────────────────────────────
        if len(df) > 1:
            date_diffs = pd.Series(df.index).diff().dt.days.dropna()
            max_gap    = int(date_diffs.max())
            if max_gap > gap_days:
                first_over = date_diffs[date_diffs > gap_days]
                if len(first_over):
                    gap_loc = df.index[first_over.index[0]]
                    msgs.append(
                        f"WARN: {max_gap}-calendar-day data gap ending "
                        f"{str(gap_loc)[:10]} — prices in this gap are forward-filled"
                    )

        cleaned[ticker] = df

        if msgs:
            messages.append(f"{ticker}: " + "; ".join(msgs))
            print(f"[data_cleaner] {ticker}: " + "; ".join(msgs), file=sys.stderr)
        else:
            print(f"[data_cleaner] {ticker}: clean — no anomalies detected", file=sys.stderr)

    return cleaned, messages
