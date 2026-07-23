from fastapi import Header, HTTPException, status
from app.core.config import settings


async def verify_internal_key(x_internal_api_key: str = Header(...)) -> None:
    """
    FastAPI dependency injected into every route. The Node API sets this
    header on every call (see ai.service.ts). Requests without it — or
    with the wrong key — are rejected at the door, before any LLM token
    is spent.
    """
    if x_internal_api_key != settings.internal_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal API key",
        )
