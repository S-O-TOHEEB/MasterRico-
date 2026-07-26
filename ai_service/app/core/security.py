import hmac
from fastapi import Header, HTTPException, status
from app.core.config import settings


async def verify_internal_key(x_internal_api_key: str = Header(...)) -> None:
    """
    FastAPI dependency injected into every route. The Node API sets this
    header on every call (see ai.service.ts). Requests without it — or
    with the wrong key — are rejected at the door, before any LLM token
    is spent.

    Uses hmac.compare_digest (constant-time) rather than != — a plain
    string comparison short-circuits on the first mismatched byte, which
    is a real (if minor) timing side-channel on a secret being compared
    server-to-server. Matches the timingSafeEqual comparisons already used
    for webhook signatures on the Node side.
    """
    if not hmac.compare_digest(x_internal_api_key, settings.internal_api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal API key",
        )
