"""
Firebase Admin SDK initialization and helper functions.
Provides read/write access to Firebase Realtime Database.

Gracefully degrades if no service account is available — returns
defaults instead of crashing the entire backend.
"""

import os
import firebase_admin
from firebase_admin import credentials, db
from app.config import get_settings

_initialized = False
_available = False


def _init_firebase():
    """Initialize Firebase Admin SDK (idempotent). Safe to call when no creds exist."""
    global _initialized, _available
    if _initialized:
        return

    settings = get_settings()
    _initialized = True

    # Check if service account file exists
    sa_path = settings.firebase_service_account_path
    if os.path.isfile(sa_path):
        try:
            cred = credentials.Certificate(sa_path)
            firebase_admin.initialize_app(cred, {
                "databaseURL": settings.firebase_database_url
            })
            _available = True
            print("[Firebase] Initialized with service account.")
        except Exception as e:
            print(f"[Firebase] Failed to init with service account: {e}")
            _available = False
    else:
        print(f"[Firebase] No service account at '{sa_path}' — running in offline mode.")
        _available = False


def is_available() -> bool:
    """Check if Firebase is initialized and available."""
    _init_firebase()
    return _available


def get_ref(path: str) -> db.Reference:
    """Get a Firebase RTDB reference at the given path."""
    _init_firebase()
    if not _available:
        raise RuntimeError("Firebase not available")
    return db.reference(path)


# ---------------------------------------------------------------------------
# User data helpers — all return safe defaults when Firebase is unavailable
# ---------------------------------------------------------------------------

def get_user_profile(user_id: str) -> dict | None:
    """Read the user profile from Firebase."""
    if not is_available():
        return None
    try:
        ref = get_ref(f"users/{user_id}/profile")
        return ref.get()
    except Exception:
        return None


def get_digital_twin(user_id: str) -> dict | None:
    """Read the current digital twin state."""
    if not is_available():
        return None
    try:
        ref = get_ref(f"users/{user_id}/digital_twin")
        return ref.get()
    except Exception:
        return None


def save_digital_twin(user_id: str, twin_data: dict):
    """Write/update the digital twin state."""
    if not is_available():
        return
    try:
        ref = get_ref(f"users/{user_id}/digital_twin")
        ref.update(twin_data)
    except Exception as e:
        print(f"[Firebase] Save twin failed: {e}")


def get_telemetry(user_id: str, limit: int = 30) -> list[dict]:
    """Read recent telemetry entries (most recent first)."""
    if not is_available():
        return []
    try:
        ref = get_ref(f"users/{user_id}/telemetry_stream")
        snapshot = ref.order_by_child("timestamp").limit_to_last(limit).get()
        if not snapshot:
            return []
        return list(snapshot.values())
    except Exception:
        return []


def save_telemetry(user_id: str, entry: dict):
    """Append a telemetry entry."""
    if not is_available():
        return
    try:
        ref = get_ref(f"users/{user_id}/telemetry_stream")
        ref.push(entry)
    except Exception as e:
        print(f"[Firebase] Save telemetry failed: {e}")


def save_state_log(user_id: str, log_entry: dict):
    """Append to the state log (meals eaten, workouts done)."""
    if not is_available():
        return
    try:
        ref = get_ref(f"users/{user_id}/state_logs")
        ref.push(log_entry)
    except Exception as e:
        print(f"[Firebase] Save state log failed: {e}")


def get_user_meals(user_id: str) -> dict | None:
    """Read all saved meals."""
    if not is_available():
        return None
    try:
        ref = get_ref(f"users/{user_id}/meals")
        return ref.get()
    except Exception:
        return None
