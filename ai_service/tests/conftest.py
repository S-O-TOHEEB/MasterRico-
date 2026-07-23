import os
import pytest
from httpx import AsyncClient, ASGITransport

# Provide dummy env vars before the app (and its settings) is imported
os.environ.setdefault("INTERNAL_API_KEY", "test-key")
os.environ.setdefault("OPENAI_API_KEY", "sk-test")

from app.main import app  # noqa: E402 — import after env is set


@pytest.fixture
async def client() -> AsyncClient:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


VALID_HEADERS = {"X-Internal-Api-Key": "test-key"}
