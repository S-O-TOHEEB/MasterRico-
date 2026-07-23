from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check() -> dict[str, str]:
    """
    Simple liveness check — called by docker-compose healthcheck and the
    Node API's startup probe. No auth required (no business data exposed).
    """
    return {"status": "ok", "service": "edustream-ai-service"}
