import os
import sys
import uuid
import math
import json
import tempfile
from pathlib import Path
from typing import Optional

import anthropic as _anthropic

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

_TEST_EMAILS = {e.strip().lower() for e in os.environ.get("TEST_USER_EMAILS", "").split(",") if e.strip()}

_SKILLS_DIR = os.path.join(os.path.dirname(__file__), "skills")
if _SKILLS_DIR not in sys.path:
    sys.path.insert(0, _SKILLS_DIR)

from claude_client import parse_strategy
import backtest_runner
from auth import get_current_user, db
import billing

app = FastAPI(title="Strategy Backtester API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(billing.router)

_sessions: dict[str, dict] = {}

TEMP_BASE = Path(tempfile.gettempdir()) / "backtester"
TEMP_BASE.mkdir(exist_ok=True)


class BacktestRequest(BaseModel):
    strategy: str
    initial_capital: float = 1_000_000
    start_date: Optional[str] = None


class ImprovementRequest(BaseModel):
    strategy: str
    summary: dict


def _friendly_error(raw: str) -> dict:
    r = raw.lower()

    if any(k in r for k in ("yahoo", "yfinance", "fetch_prices", "allowlist",
                             "query1.finance", "query2.finance", "host not")):
        return {
            "headline": "Couldn't fetch market data",
            "detail":   "The backtester couldn't connect to Yahoo Finance to download historical prices.",
            "suggestion": "Check your internet connection and try again. If the problem persists, Yahoo Finance may be temporarily unavailable.",
        }

    if "no price data" in r or "no data returned" in r:
        return {
            "headline": "No price data found",
            "detail":   "Yahoo Finance returned no historical data for the ticker(s) in your strategy.",
            "suggestion": "Try naming a specific stock or index more clearly — e.g. 'Nifty 50', 'Reliance Industries', or 'TCS'. Indian NSE stocks need the .NS suffix internally.",
        }

    if "ticker" in r and ("invalid" in r or "not found" in r or "delisted" in r):
        return {
            "headline": "Unknown ticker symbol",
            "detail":   "One or more ticker symbols in your strategy couldn't be found on Yahoo Finance.",
            "suggestion": "Double-check the company or index name. For example, use 'Nifty 50', 'HDFC Bank', or 'Infosys' and we'll resolve the right symbol automatically.",
        }

    if any(k in r for k in ("json", "parse_strategy", "strategy parsing",
                             "missing required field", "jsondecodeerror")):
        return {
            "headline": "Couldn't interpret the strategy",
            "detail":   "The AI had trouble understanding your strategy description and couldn't convert it into backtest rules.",
            "suggestion": "Try rephrasing with clear entry and exit conditions. For example: 'Buy Nifty 50 when the 50-day moving average crosses above the 200-day moving average. Sell when it crosses back below.'",
        }

    if "anthropic_api_key" in r or "api key" in r or "authentication" in r:
        return {
            "headline": "API configuration issue",
            "detail":   "The server's Anthropic API key is missing or invalid.",
            "suggestion": "Contact the administrator to verify the API key in the backend .env file.",
        }

    if "indicator code" in r or "indicators_code" in r:
        return {
            "headline": "Indicator calculation failed",
            "detail":   "The backtester couldn't compute the technical indicators needed for your strategy.",
            "suggestion": "Try simplifying your strategy. For example: 'Buy when RSI drops below 30, sell when it rises above 70' works well for a single indicator.",
        }

    if "on_bar" in r or "on_bar code" in r or "nameerror" in r or "attributeerror" in r or "typeerror" in r:
        return {
            "headline": "Strategy logic couldn't be built",
            "detail":   "The AI generated strategy code ran into a runtime error. This usually happens with complex multi-condition strategies.",
            "suggestion": "Try describing a simpler strategy first — for example: 'Buy Nifty 50 when the 20-day moving average crosses above the 50-day moving average. Sell when it crosses back below.'",
        }

    if "no trades" in r or "trade_log" in r and "empty" in r:
        return {
            "headline": "No trades were executed",
            "detail":   "The strategy ran over the historical period but never triggered a buy or sell signal.",
            "suggestion": "Your conditions may be too strict. Try loosening the entry rules — for example, use a shorter moving average period or a wider RSI threshold.",
        }

    if "initial capital" in r or "cash" in r:
        return {
            "headline": "Capital configuration error",
            "detail":   "There was an issue with the starting capital or position sizing in your strategy.",
            "suggestion": "Try specifying a capital amount in your strategy, e.g. 'starting with ₹10 lakh'.",
        }

    if any(k in r for k in ("openpyxl", "excel", "xlsx", "report", "pdf", "reportlab")):
        return {
            "headline": "Report generation failed",
            "detail":   "The backtest completed but there was an error creating the downloadable report.",
            "suggestion": "Try running the backtest again. If the issue continues, try a simpler strategy first.",
        }

    return {
        "headline": "Backtesting hit a roadblock",
        "detail":   "An unexpected error occurred while running your strategy.",
        "suggestion": "Try rephrasing your strategy more clearly. If the problem repeats, simplify the conditions — start with a single entry rule like 'Buy Nifty when RSI is below 30'.",
    }


def _check_credits(user: dict):
    if user.get("email", "").lower() in _TEST_EMAILS:
        return
    credits = user.get("credits", 0)
    if isinstance(credits, float):
        credits = int(credits)
    if credits < 1:
        raise HTTPException(
            status_code=402,
            detail={
                "headline": "No credits remaining",
                "detail": "You've used all your free beta credits.",
                "suggestion": "Thank you for testing! Reach out to us for more credits.",
            },
        )


def _firestore_safe(obj):
    """Recursively convert numpy/NaN/Inf types to Firestore-safe Python types."""
    if isinstance(obj, dict):
        return {k: _firestore_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_firestore_safe(v) for v in obj]
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    # Convert numpy scalars (float64, int64, etc.) to native Python types
    try:
        import numpy as np
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            v = float(obj)
            return None if (math.isnan(v) or math.isinf(v)) else v
        if isinstance(obj, np.ndarray):
            return obj.tolist()
    except ImportError:
        pass
    return obj


def _deduct_credit_and_save(user_id: str, strategy: str, summary: dict, download_id: str, user_email: str = ""):
    """Atomically decrement credits by 1 and save the backtest record."""
    if db is None:
        return

    from firebase_admin import firestore as _fs
    from google.cloud.firestore import transactional as _transactional

    is_test = user_email.lower() in _TEST_EMAILS
    user_ref = db.collection("users").document(user_id)
    safe_summary = _firestore_safe(summary)
    bt_data = {
        "strategy": strategy[:200],
        "status": "completed",
        "summary": safe_summary,
        "download_id": download_id,
        "created_at": _fs.SERVER_TIMESTAMP,
    }

    @_transactional
    def _run(transaction):
        snap = user_ref.get(transaction=transaction)
        credits = (snap.to_dict() or {}).get("credits", 0)
        if isinstance(credits, float):
            credits = int(credits)
        if not is_test:
            if credits < 1:
                raise ValueError("no_credits")
            transaction.update(user_ref, {"credits": credits - 1})
        bt_ref = user_ref.collection("backtests").document()
        transaction.set(bt_ref, bt_data)

    _run(db.transaction())


@app.post("/api/backtest")
async def backtest(
    req: BacktestRequest,
    user: dict = Depends(get_current_user),
):
    if not req.strategy.strip():
        raise HTTPException(
            status_code=400,
            detail={
                "headline": "No strategy entered",
                "detail":   "Please describe your trading strategy before running the backtest.",
                "suggestion": "Try something like: 'Buy Nifty 50 when the 20-day SMA crosses above the 50-day SMA. Sell when it crosses back below.'",
            }
        )

    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(
            status_code=500,
            detail={
                "headline": "API configuration issue",
                "detail":   "The server's Anthropic API key is not configured.",
                "suggestion": "Contact the administrator to set up the API key.",
            }
        )

    _check_credits(user)

    try:
        spec = parse_strategy(req.strategy)
    except Exception as e:
        raise HTTPException(status_code=500, detail=_friendly_error(str(e)))

    spec["initial_capital"] = req.initial_capital
    if req.start_date:
        spec["start_date"] = req.start_date

    download_id = str(uuid.uuid4())
    dl_dir = str(TEMP_BASE / download_id)

    try:
        result = backtest_runner.run(spec, dl_dir)
    except Exception as e:
        raise HTTPException(status_code=422, detail=_friendly_error(str(e)))

    _sessions[download_id] = {
        "excel":   result["excel_path"],
        "pdf":     result["pdf_path"],
        "summary": result["summary"],
    }

    try:
        _deduct_credit_and_save(
            user_id=user["id"],
            strategy=req.strategy,
            summary=result["summary"],
            download_id=download_id,
            user_email=user.get("email", ""),
        )
    except ValueError as e:
        if "no_credits" in str(e):
            raise HTTPException(status_code=402, detail={
                "headline": "Out of credits",
                "detail": "You've used all your free beta credits.",
                "suggestion": "Thank you for testing! Reach out to us for more credits.",
            })
        print(f"[ERROR] _deduct_credit_and_save failed for {user['id']}: {e}", flush=True)
    except Exception as e:
        print(f"[ERROR] _deduct_credit_and_save failed for {user['id']}: {e}", flush=True)

    return {
        "download_id": download_id,
        "summary":     result["summary"],
    }


@app.post("/api/suggest-improvements")
async def suggest_improvements(
    req: ImprovementRequest,
    user: dict = Depends(get_current_user),
):
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="API not configured")

    metrics = req.summary.get("metrics", {})

    def _fmt(v, suffix=""):
        if v is None:
            return "N/A"
        if isinstance(v, float):
            return f"{v:.2f}{suffix}"
        return f"{v}{suffix}"

    metrics_text = (
        f"- CAGR: {_fmt(metrics.get('cagr_pct'), '%')}\n"
        f"- Total Return: {_fmt(metrics.get('total_return_pct'), '%')}\n"
        f"- Sharpe Ratio: {_fmt(metrics.get('sharpe_ratio'))}\n"
        f"- Max Drawdown: {_fmt(metrics.get('max_drawdown_pct'), '%')}\n"
        f"- Win Rate: {_fmt(metrics.get('win_rate_pct'), '%')}\n"
        f"- Total Trades: {metrics.get('total_trades', 'N/A')}\n"
        f"- Profit Factor: {_fmt(metrics.get('profit_factor'))}\n"
        f"- Avg Trade Return: {_fmt(metrics.get('avg_trade_return_pct'), '%')}"
    )

    prompt = f"""You are an expert quantitative trading strategist. A user ran a backtest with this strategy:

STRATEGY:
{req.strategy}

BACKTEST RESULTS:
{metrics_text}

Your task: Generate exactly 3 concrete, actionable improvement instructions for this strategy. Each instruction is a SHORT addition (1-2 sentences) that will be APPENDED to the original strategy — not a full rewrite. Think of it as a refinement note the user adds on top of their existing rules.

Focus on different angles — e.g. one on entry timing, one on exit/risk management, one on universe/filters. Base suggestions on the actual weaknesses in the metrics (e.g. high drawdown → add stop-loss; low win rate → tighter entry; few trades → loosen filters).

Respond ONLY with valid JSON in this exact format, no preamble:
{{
  "suggestions": [
    {{
      "title": "Short improvement name (5-8 words)",
      "issue": "One sentence explaining what weakness this addresses",
      "instruction": "Short refinement instruction to append to the strategy (1-2 sentences max)"
    }}
  ]
}}"""

    try:
        client = _anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        parsed = json.loads(raw)
        suggestions = parsed.get("suggestions", [])[:3]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate suggestions: {e}")

    return {"suggestions": suggestions}


@app.get("/api/me")
async def get_me(user: dict = Depends(get_current_user)):
    email = user.get("email", "")
    credits = 999 if email.lower() in _TEST_EMAILS else int(user.get("credits", 0))
    return {"email": email, "credits": credits}


@app.get("/api/history")
async def get_history(user: dict = Depends(get_current_user)):
    if db is None:
        return {"backtests": []}

    docs = (
        db.collection("users")
        .document(user["id"])
        .collection("backtests")
        .order_by("created_at", direction="DESCENDING")
        .limit(20)
        .get()
    )

    results = []
    for doc in docs:
        d = doc.to_dict()
        metrics = (d.get("summary") or {}).get("metrics", {})
        results.append({
            "id": doc.id,
            "strategy": d.get("strategy", ""),
            "download_id": d.get("download_id", ""),
            "created_at": d.get("created_at").isoformat() if d.get("created_at") else "",
            "total_return_pct": metrics.get("total_return_pct"),
            "cagr_pct": metrics.get("cagr_pct"),
            "sharpe_ratio": metrics.get("sharpe_ratio"),
            "summary": d.get("summary"),
        })

    return {"backtests": results}


@app.get("/api/download/{download_id}/excel")
async def download_excel(download_id: str):
    session = _sessions.get(download_id)
    if not session:
        raise HTTPException(status_code=404, detail={
            "headline": "Session expired",
            "detail":   "This download link is no longer available.",
            "suggestion": "Run the backtest again to generate a new report.",
        })
    return FileResponse(
        session["excel"],
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="backtest_report.xlsx",
    )


@app.get("/api/download/{download_id}/pdf")
async def download_pdf(download_id: str):
    session = _sessions.get(download_id)
    if not session:
        raise HTTPException(status_code=404, detail={
            "headline": "Session expired",
            "detail":   "This download link is no longer available.",
            "suggestion": "Run the backtest again to generate a new report.",
        })
    return FileResponse(
        session["pdf"],
        media_type="application/pdf",
        filename="backtest_report.pdf",
    )


_SAMPLE_SPEC = {
    "tickers": ["^NSEI"],
    "benchmark_ticker": "^NSEI",
    "start_date": "2014-01-01",
    "initial_capital": 1_000_000,
    "commission_bps": 5.0,
    "slippage_bps": 5.0,
    "risk_free_rate": 0.07,
    "bar_frequency": "daily",
    "strategy_name": "Nifty 50 — Golden Cross",
    "strategy_description": (
        "Buy Nifty 50 when the 50-day moving average crosses above the 200-day moving average (Golden Cross). "
        "Sell and hold cash when it crosses back below (Death Cross). "
        "Initial capital ₹10 lakh, daily bars, 10-year backtest."
    ),
    "indicators_code": (
        "sma50  = {t: ind.sma(closes[t], 50)  for t in closes}\n"
        "sma200 = {t: ind.sma(closes[t], 200) for t in closes}\n"
        "extra_data = {'sma50': sma50, 'sma200': sma200}\n"
    ),
    "on_bar_code": (
        "def on_bar(ctx):\n"
        "    for ticker in ctx.tickers:\n"
        "        fast = ctx.ind('sma50',  ticker)\n"
        "        slow = ctx.ind('sma200', ticker)\n"
        "        if fast is None or slow is None:\n"
        "            continue\n"
        "        in_pos = ctx.portfolio.shares_of(ticker) > 0\n"
        "        if fast > slow and not in_pos:\n"
        "            ctx.portfolio.set_target_weight(ticker, 1.0, reason='golden_cross')\n"
        "        elif fast < slow and in_pos:\n"
        "            ctx.portfolio.set_target_weight(ticker, 0.0, reason='death_cross')\n"
    ),
}

_SAMPLE_DIR  = str(TEMP_BASE / "sample")
_sample_lock = __import__("asyncio").Lock()


@app.get("/api/sample-report")
async def sample_report():
    """Return a pre-generated sample Excel backtest report (cached after first call)."""
    excel_path = Path(_SAMPLE_DIR) / "sample_backtest_report.xlsx"

    async with _sample_lock:
        if not excel_path.exists():
            try:
                result = backtest_runner.run(_SAMPLE_SPEC, _SAMPLE_DIR)
                excel_path = Path(result["excel_path"])
            except Exception as e:
                raise HTTPException(status_code=503, detail={
                    "headline": "Sample report unavailable",
                    "detail": "Could not generate the sample report right now.",
                    "suggestion": str(e),
                })

    return FileResponse(
        str(excel_path),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="backtest_ai_sample_report.xlsx",
    )


@app.get("/health")
async def health():
    return {"status": "ok"}
