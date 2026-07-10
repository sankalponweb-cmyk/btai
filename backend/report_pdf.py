"""
report_pdf.py
=============
Generates a multi-page PDF summary from a real BacktestResult.
Uses reportlab. Covers:
  Page 1 — Strategy overview + headline performance metrics
  Page 2 — Equity curve chart
  Page 3 — Trade statistics table
  Page 4 — Annual returns table + recent trades
"""

import math
import pandas as pd
import numpy as np

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
)
from reportlab.graphics.shapes import Drawing, Line, Rect, PolyLine, String

# ── Colour palette ────────────────────────────────────────────────────────────
BG         = colors.HexColor("#0a0e1a")
HEADER_BG  = colors.HexColor("#1F4E78")
CYAN       = colors.HexColor("#00d4ff")
GREEN      = colors.HexColor("#00c853")
RED        = colors.HexColor("#ff4444")
WHITE      = colors.white
LIGHT_GRAY = colors.HexColor("#b0b8c8")
MID_GRAY   = colors.HexColor("#2a3148")
TEXT_DARK  = colors.HexColor("#e6edf3")
ALT_ROW    = colors.HexColor("#131929")


def _is_nan(v):
    try:
        return math.isnan(float(v))
    except (TypeError, ValueError):
        return False


def _pct(v, decimals=2):
    if v is None or _is_nan(v):
        return "—"
    return f"{float(v):+.{decimals}f}%"


def _num(v, decimals=2):
    if v is None or _is_nan(v):
        return "—"
    return f"{float(v):,.{decimals}f}"


def _fmt_currency(v):
    if v is None or _is_nan(v):
        return "—"
    return f"Rs{float(v):,.0f}"


def generate_pdf(path, spec, perf, tstats, trade_log, equity_curve,
                  benchmark_curve=None, ann_df=None):
    doc = SimpleDocTemplate(
        path,
        pagesize=A4,
        leftMargin=18*mm, rightMargin=18*mm,
        topMargin=18*mm, bottomMargin=18*mm,
    )

    W, H = A4
    content_w = W - 36*mm

    body = ParagraphStyle(
        "body", fontName="Helvetica", fontSize=9,
        textColor=TEXT_DARK, leading=14, spaceAfter=4,
    )
    heading1 = ParagraphStyle(
        "h1", fontName="Helvetica-Bold", fontSize=16,
        textColor=CYAN, leading=20, spaceAfter=6,
    )
    heading2 = ParagraphStyle(
        "h2", fontName="Helvetica-Bold", fontSize=11,
        textColor=CYAN, leading=16, spaceAfter=4,
    )
    label_style = ParagraphStyle(
        "label", fontName="Helvetica-Bold", fontSize=7,
        textColor=LIGHT_GRAY, leading=11,
    )
    value_style = ParagraphStyle(
        "value", fontName="Helvetica-Bold", fontSize=10,
        textColor=WHITE, leading=14,
    )
    footer_style = ParagraphStyle(
        "footer", fontName="Helvetica", fontSize=7,
        textColor=LIGHT_GRAY, leading=10,
    )

    def dark_table(data, col_widths, header=True):
        t = Table(data, colWidths=col_widths, repeatRows=1 if header else 0)
        t.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0),  HEADER_BG),
            ("FONTNAME",      (0, 0), (-1, 0),  "Helvetica-Bold"),
            ("FONTNAME",      (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE",      (0, 0), (-1, -1), 8),
            ("TEXTCOLOR",     (0, 0), (-1, 0),  WHITE),
            ("ROWBACKGROUNDS",(0, 1), (-1, -1), [BG, ALT_ROW]),
            ("TEXTCOLOR",     (0, 1), (-1, -1), TEXT_DARK),
            ("ALIGN",         (0, 0), (0, -1),  "LEFT"),
            ("ALIGN",         (1, 0), (-1, -1), "RIGHT"),
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING",    (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING",   (0, 0), (-1, -1), 6),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
            ("LINEBELOW",     (0, 0), (-1, 0),  0.5, CYAN),
            ("GRID",          (0, 0), (-1, -1), 0.3, MID_GRAY),
        ]))
        return t

    story = []

    # ── Page 1: Overview ──────────────────────────────────────────────────────
    story.append(Paragraph(spec.get("strategy_name", "Strategy Backtest"), heading1))
    story.append(HRFlowable(width="100%", thickness=0.5, color=CYAN, spaceAfter=6))

    desc = spec.get("description", "")
    if desc:
        story.append(Paragraph(desc, body))
        story.append(Spacer(1, 5*mm))

    start_d = perf.get("Start Date", "—")
    end_d   = perf.get("End Date",   "—")
    dur     = perf.get("Duration (Years)", 0)

    cards = [
        ("Period",                  f"{start_d} to {end_d} ({dur:.1f} yrs)"),
        ("Initial Capital",         _fmt_currency(perf.get("Initial Capital", 0))),
        ("Final Equity",            _fmt_currency(perf.get("Final Equity", 0))),
        ("Total Return",            _pct(perf.get("Total Return (%)", 0))),
        ("CAGR",                    _pct(perf.get("CAGR (%)", 0))),
        ("Annualized Volatility",   _pct(perf.get("Annualized Volatility (%)", 0))),
        ("Sharpe Ratio",            _num(perf.get("Sharpe Ratio"))),
        ("Sortino Ratio",           _num(perf.get("Sortino Ratio"))),
        ("Calmar Ratio",            _num(perf.get("Calmar Ratio"))),
        ("Max Drawdown",            _pct(perf.get("Max Drawdown (%)", 0))),
        ("Max DD Duration",         f"{perf.get('Max Drawdown Duration (days)', 0):.0f} days"),
        ("Avg Exposure",            _pct(perf.get("Average Exposure (%)", 0))),
        ("Best Day",                _pct(perf.get("Best Day (%)", 0))),
        ("Worst Day",               _pct(perf.get("Worst Day (%)", 0))),
        ("Positive Periods",        _pct(perf.get("Positive Periods (%)", 0))),
    ]

    col3 = content_w / 3
    grid = []
    for i in range(0, len(cards), 3):
        row = []
        for j in range(3):
            if i + j < len(cards):
                lbl, val = cards[i + j]
                row.append([Paragraph(lbl, label_style), Paragraph(val, value_style)])
            else:
                row.append(["", ""])
        grid.append(row)

    metric_table = Table(grid, colWidths=[col3, col3, col3])
    metric_table.setStyle(TableStyle([
        ("ROWBACKGROUNDS",(0, 0), (-1, -1), [MID_GRAY, ALT_ROW]),
        ("BOX",           (0, 0), (-1, -1), 0.5, CYAN),
        ("INNERGRID",     (0, 0), (-1, -1), 0.3, colors.HexColor("#1a2040")),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 7),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 7),
    ]))
    story.append(metric_table)
    story.append(Spacer(1, 6*mm))

    rules = spec.get("rules", [])
    if rules:
        story.append(Paragraph("Strategy Rules", heading2))
        for r in rules:
            story.append(Paragraph(f"• {r}", body))
        story.append(Spacer(1, 5*mm))

    # Benchmark row
    bm_tr = perf.get("Benchmark Total Return (%)")
    bm_cagr = perf.get("Benchmark CAGR (%)")
    if bm_tr is not None and not _is_nan(bm_tr):
        story.append(Paragraph("Benchmark Comparison (Buy & Hold)", heading2))
        bm_data = [
            ["Metric", "Strategy", "Benchmark"],
            ["Total Return", _pct(perf.get("Total Return (%)", 0)), _pct(bm_tr)],
            ["CAGR",         _pct(perf.get("CAGR (%)", 0)),          _pct(bm_cagr)],
        ]
        story.append(dark_table(bm_data, [col3 * 1.2, col3 * 0.9, col3 * 0.9]))
        story.append(Spacer(1, 5*mm))

    # ── Equity curve chart ────────────────────────────────────────────────────
    story.append(Paragraph("Equity Curve", heading2))
    eq = equity_curve.dropna()
    if len(eq) > 1:
        chart = _build_equity_chart(eq, benchmark_curve, width=float(content_w), height=110*mm)
        story.append(chart)
        story.append(Spacer(1, 5*mm))

    # ── Trade statistics ──────────────────────────────────────────────────────
    story.append(Paragraph("Trade Statistics", heading2))
    half = content_w / 2 - 2*mm
    stat_rows = [["Metric", "Value"]]
    stat_items = [
        ("Total Trades",           lambda: str(int(tstats.get("Total Trades", 0)))),
        ("Winning Trades",         lambda: str(int(tstats.get("Winning Trades", 0)))),
        ("Losing Trades",          lambda: str(int(tstats.get("Losing Trades", 0)))),
        ("Win Rate",               lambda: _pct(tstats.get("Win Rate (%)", 0))),
        ("Profit Factor",          lambda: _num(tstats.get("Profit Factor"))),
        ("Payoff Ratio",           lambda: _num(tstats.get("Payoff Ratio"))),
        ("Expectancy",             lambda: _fmt_currency(tstats.get("Expectancy (₹/unit)"))),
        ("Avg Trade Return",       lambda: _pct(tstats.get("Avg Trade Return (%)", 0))),
        ("Avg Win (%)",            lambda: _pct(tstats.get("Avg Win (%)", 0))),
        ("Avg Loss (%)",           lambda: _pct(tstats.get("Avg Loss (%)", 0))),
        ("Largest Win",            lambda: _fmt_currency(tstats.get("Largest Win (₹)"))),
        ("Largest Loss",           lambda: _fmt_currency(tstats.get("Largest Loss (₹)"))),
        ("Gross Profit",           lambda: _fmt_currency(tstats.get("Gross Profit (₹)"))),
        ("Gross Loss",             lambda: _fmt_currency(tstats.get("Gross Loss (₹)"))),
        ("Avg Holding (days)",     lambda: _num(tstats.get("Avg Holding Period (days)"), 1)),
        ("Max Consecutive Wins",   lambda: str(int(tstats.get("Max Consecutive Wins", 0)))),
        ("Max Consecutive Losses", lambda: str(int(tstats.get("Max Consecutive Losses", 0)))),
    ]
    for label, fn in stat_items:
        try:
            stat_rows.append([label, fn()])
        except Exception:
            stat_rows.append([label, "—"])
    story.append(dark_table(stat_rows, [half * 1.1, half * 0.9]))
    story.append(Spacer(1, 5*mm))

    # ── Annual returns ────────────────────────────────────────────────────────
    if ann_df is not None and not ann_df.empty:
        story.append(Paragraph("Annual Returns", heading2))
        ann_rows = [["Year", "End Equity", "Return"]]
        ann_colors_map = {}
        for i, (_, row) in enumerate(ann_df.iterrows(), start=1):
            ret = row.get("Return (%)", 0)
            ann_rows.append([str(int(row["Year"])), _fmt_currency(row["End Equity"]), _pct(ret)])
            ann_colors_map[i] = GREEN if float(ret) >= 0 else RED
        third = content_w / 3
        ann_table = dark_table(ann_rows, [third * 0.6, third * 1.2, third * 1.2])
        for row_idx, color in ann_colors_map.items():
            ann_table.setStyle(TableStyle([("TEXTCOLOR", (2, row_idx), (2, row_idx), color)]))
        story.append(ann_table)
        story.append(Spacer(1, 5*mm))

    # ── Recent trades ─────────────────────────────────────────────────────────
    if trade_log is not None and not trade_log.empty:
        story.append(Paragraph("Recent Trades (last 20)", heading2))
        tl = trade_log.tail(20).copy()
        trade_rows = [["Ticker", "Side", "Entry Date", "Exit Date", "Shares", "P&L", "Return%", "Reason"]]
        trade_color_map = {}
        for i, (_, row) in enumerate(tl.iterrows(), start=1):
            pnl    = row.get("pnl", 0)
            ret    = row.get("return_pct", 0) * 100
            trade_rows.append([
                str(row.get("ticker", "")),
                str(row.get("side", "")),
                str(row.get("entry_date", ""))[:10],
                str(row.get("exit_date",  ""))[:10],
                f"{row.get('shares', 0):,.1f}",
                _fmt_currency(pnl),
                _pct(ret),
                str(row.get("exit_reason", ""))[:16],
            ])
            trade_color_map[i] = GREEN if float(pnl) >= 0 else RED
        col8 = content_w / 8
        tr_table = dark_table(trade_rows,
            [col8*0.8, col8*0.55, col8*0.9, col8*0.9, col8*0.65, col8*1.1, col8*0.85, col8*1.25])
        for row_idx, color in trade_color_map.items():
            tr_table.setStyle(TableStyle([
                ("TEXTCOLOR", (5, row_idx), (5, row_idx), color),
                ("TEXTCOLOR", (6, row_idx), (6, row_idx), color),
            ]))
        story.append(tr_table)

    story.append(Spacer(1, 8*mm))
    story.append(HRFlowable(width="100%", thickness=0.3, color=LIGHT_GRAY))
    story.append(Paragraph(
        "Generated by BT.AI. Historical results do not guarantee future performance. Not financial advice.",
        footer_style,
    ))

    doc.build(story, onFirstPage=_dark_page, onLaterPages=_dark_page)


def _dark_page(canvas, doc):
    W, H = A4
    canvas.saveState()
    canvas.setFillColor(BG)
    canvas.rect(0, 0, W, H, fill=1, stroke=0)
    canvas.restoreState()


def _build_equity_chart(equity, benchmark=None, width=500.0, height=310.0):
    W, H = float(width), float(height)
    pad_l, pad_r, pad_t, pad_b = 58, 12, 14, 28

    plot_w = W - pad_l - pad_r
    plot_h = H - pad_t - pad_b

    d = Drawing(W, H)
    d.add(Rect(0, 0, W, H, fillColor=MID_GRAY, strokeColor=None))
    d.add(Rect(pad_l, pad_b, plot_w, plot_h, fillColor=BG,
               strokeColor=colors.HexColor("#1a2040"), strokeWidth=0.5))

    vals  = list(equity.values)
    dates = list(equity.index)
    n = len(vals)
    if n < 2:
        return d

    vmin, vmax = min(vals), max(vals)
    if vmax == vmin:
        vmax = vmin * 1.01 + 1

    def sx(i):
        return pad_l + (i / (n - 1)) * plot_w

    def sy(v):
        return pad_b + ((v - vmin) / (vmax - vmin)) * plot_h

    # Horizontal grid lines
    for frac in [0.0, 0.25, 0.5, 0.75, 1.0]:
        y = pad_b + frac * plot_h
        v = vmin + frac * (vmax - vmin)
        d.add(Line(pad_l, y, pad_l + plot_w, y,
                   strokeColor=colors.HexColor("#2a3148"), strokeWidth=0.4))
        lbl = f"Rs{v/1e5:.1f}L" if v >= 1e5 else f"Rs{v:,.0f}"
        d.add(String(pad_l - 4, y - 3, lbl,
                     fontName="Helvetica", fontSize=6,
                     textAnchor="end", fillColor=LIGHT_GRAY))

    # X-axis year labels
    years_seen = set()
    for i, dt in enumerate(dates):
        yr = pd.Timestamp(dt).year
        if yr not in years_seen:
            years_seen.add(yr)
            x = sx(i)
            d.add(Line(x, pad_b, x, pad_b - 4, strokeColor=LIGHT_GRAY, strokeWidth=0.5))
            d.add(String(x, pad_b - 12, str(yr),
                         fontName="Helvetica", fontSize=6,
                         textAnchor="middle", fillColor=LIGHT_GRAY))

    # Benchmark line
    if benchmark is not None:
        try:
            b = benchmark.dropna().reindex(equity.index, method="ffill").dropna()
            if len(b) > 1:
                b_norm = b / b.iloc[0] * equity.iloc[0]
                bv = list(b_norm.values)
                bpts = []
                for i in range(min(n, len(bv))):
                    bpts += [sx(i), sy(bv[i])]
                if len(bpts) >= 4:
                    d.add(PolyLine(bpts,
                                   strokeColor=colors.HexColor("#888888"),
                                   strokeWidth=1.0, strokeDashArray=[3, 2]))
        except Exception:
            pass

    # Area fill strips
    fill_color = colors.HexColor("#003844")
    for i in range(n - 1):
        x1, y1 = sx(i),     sy(vals[i])
        x2, y2 = sx(i + 1), sy(vals[i + 1])
        pts = [x1, pad_b, x1, y1, x2, y2, x2, pad_b]
        d.add(PolyLine(pts, strokeColor=None, fillColor=fill_color))

    # Equity line
    pts = []
    for i in range(n):
        pts += [sx(i), sy(vals[i])]
    d.add(PolyLine(pts, strokeColor=CYAN, strokeWidth=1.5))

    # Legend
    legend_y = H - pad_t + 2
    d.add(Line(pad_l, legend_y, pad_l + 14, legend_y, strokeColor=CYAN, strokeWidth=1.5))
    d.add(String(pad_l + 17, legend_y - 3, "Strategy",
                 fontName="Helvetica", fontSize=6, fillColor=LIGHT_GRAY))
    if benchmark is not None:
        d.add(Line(pad_l + 65, legend_y, pad_l + 79, legend_y,
                   strokeColor=colors.HexColor("#888888"), strokeWidth=1.0,
                   strokeDashArray=[3, 2]))
        d.add(String(pad_l + 82, legend_y - 3, "Buy & Hold",
                     fontName="Helvetica", fontSize=6, fillColor=LIGHT_GRAY))
    return d
