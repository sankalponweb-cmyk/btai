"""
billing.py
==========
Razorpay one-time payment endpoints.
  POST /api/billing/create-order   – creates a Razorpay order, returns details for the frontend modal
  POST /api/billing/verify-payment – verifies HMAC signature, tops up credits atomically
"""

import hmac as _hmac
import hashlib
import os

import razorpay
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import db, get_current_user

router = APIRouter()

PACK_MAP = {
    "5cr":  {"credits": 5,  "amount": 49900},   # ₹499
    "10cr": {"credits": 10, "amount": 94900},   # ₹949
    "25cr": {"credits": 25, "amount": 224900},  # ₹2,249
    "50cr": {"credits": 50, "amount": 399900},  # ₹3,999
}

_rz = razorpay.Client(
    auth=(
        os.environ.get("RAZORPAY_KEY_ID", ""),
        os.environ.get("RAZORPAY_KEY_SECRET", ""),
    )
)


class OrderRequest(BaseModel):
    pack: str


class VerifyRequest(BaseModel):
    payment_id: str
    order_id:   str
    signature:  str
    pack:       str


@router.post("/api/billing/create-order")
async def create_order(
    req: OrderRequest,
    user: dict = Depends(get_current_user),
):
    pack = PACK_MAP.get(req.pack)
    if not pack:
        raise HTTPException(400, "Invalid pack. Choose: 5cr, 10cr, 25cr, 50cr")

    if not os.environ.get("RAZORPAY_KEY_ID"):
        raise HTTPException(503, "Payment not configured")

    order = _rz.order.create(
        {
            "amount":   pack["amount"],
            "currency": "INR",
            "receipt":  user["id"][:40],
            "notes": {
                "user_id": user["id"],
                "credits": str(pack["credits"]),
            },
        }
    )
    return {
        "order_id": order["id"],
        "amount":   order["amount"],
        "currency": order["currency"],
        "key_id":   os.environ.get("RAZORPAY_KEY_ID", ""),
    }


@router.post("/api/billing/verify-payment")
async def verify_payment(
    req: VerifyRequest,
    user: dict = Depends(get_current_user),
):
    # HMAC-SHA256: secret signs "{order_id}|{payment_id}"
    key_secret = os.environ.get("RAZORPAY_KEY_SECRET", "").encode()
    msg = f"{req.order_id}|{req.payment_id}".encode()
    expected = _hmac.new(key_secret, msg, hashlib.sha256).hexdigest()
    if expected != req.signature:
        raise HTTPException(400, "Payment verification failed — invalid signature")

    pack = PACK_MAP.get(req.pack)
    if not pack:
        raise HTTPException(400, "Invalid pack")

    if db is None:
        raise HTTPException(503, "Database not configured")

    uid = user["id"]
    n   = pack["credits"]

    # Idempotency: don't credit twice for the same payment
    existing = (
        db.collection("credit_purchases")
        .where("razorpay_payment_id", "==", req.payment_id)
        .limit(1)
        .get()
    )
    if list(existing):
        return {"credits_added": 0, "already_processed": True}

    from firebase_admin import firestore as _fs
    db.collection("users").document(uid).update(
        {"credits": _fs.Increment(n)}
    )
    db.collection("credit_purchases").add(
        {
            "user_id":              uid,
            "razorpay_order_id":    req.order_id,
            "razorpay_payment_id":  req.payment_id,
            "credits_added":        n,
            "amount_paid":          pack["amount"],
            "created_at":           _fs.SERVER_TIMESTAMP,
        }
    )
    return {"credits_added": n}
