from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.v1.health import router as health_router
from app.api.v1.tagging import router as tagging_router
from app.api.v1.summarization import router as summarization_router
from app.api.v1.study_assistant import router as study_assistant_router
from app.api.v1.recommendations import router as recommendations_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up the LLM client connection pool on startup so the first real
    # request doesn't pay the connection cost.
    from app.services.llm_client import get_llm_client
    get_llm_client()
    yield
    # Cleanup on shutdown (httpx connection pool) happens automatically
    # when the AsyncOpenAI client goes out of scope.


app = FastAPI(
    title="EduStream AI Service",
    description=(
        "Internal AI microservice for auto-tagging, lesson summarisation, "
        "the Study Assistant, and personalised recommendations."
    ),
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Only the Node API (internal network) calls this service, but CORS is
# configured narrowly here in case the service is ever exposed via a
# gateway or tested from a browser during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:4000"],
    allow_methods=["POST", "GET"],
    allow_headers=["X-Internal-Api-Key", "Content-Type"],
)

app.include_router(health_router, tags=["health"])
app.include_router(tagging_router, prefix="/v1", tags=["tagging"])
app.include_router(summarization_router, prefix="/v1", tags=["summarization"])
app.include_router(study_assistant_router, prefix="/v1", tags=["study-assistant"])
app.include_router(recommendations_router, prefix="/v1", tags=["recommendations"])
