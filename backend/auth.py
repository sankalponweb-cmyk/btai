"""
auth.py
=======
Firebase Auth token verification + Firestore client.
If FIREBASE_SERVICE_ACCOUNT_JSON is not set, all endpoints run without auth
(returning a local-dev placeholder user) so the backtester still works
during local development.
"""

import os
import json

from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

_FIREBASE_SA = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
_firebase_enabled = bool(_FIREBASE_SA)

db = None

if _firebase_enabled:
    import firebase_admin
    from firebase_admin import credentials, auth as fb_auth, firestore as _fs

    if not firebase_admin._apps:
        _cred = credentials.Certificate(
            json.loads(_FIREBASE_SA) if _FIREBASE_SA.startswith("{") else _FIREBASE_SA
        )
        firebase_admin.initialize_app(_cred)

    db = _fs.client()


bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials = Security(bearer),
) -> dict:
    """Decode Firebase ID token and return the Firestore user doc.

    Auto-creates the user document (with 3 free credits) on first login.
    When Firebase is not configured, returns a local-dev placeholder so
    existing backtest routes keep working without auth.
    """
    if not _firebase_enabled:
        return {"id": "local-dev", "email": "dev@local", "credits": 999}

    if creds is None:
        raise HTTPException(status_code=401, detail="Missing auth token")

    try:
        decoded = fb_auth.verify_id_token(creds.credentials)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    uid = decoded["uid"]
    email = decoded.get("email", "")

    ref = db.collection("users").document(uid)
    doc = ref.get()

    if not doc.exists:
        from firebase_admin import firestore as _fs2
        data = {
            "email": email,
            "credits": 3,
            "created_at": _fs2.SERVER_TIMESTAMP,
        }
        ref.set(data)
        return {"id": uid, "email": email, "credits": 3}

    return {"id": uid, **doc.to_dict()}
