from unittest.mock import AsyncMock, patch
import pytest
from httpx import AsyncClient
from tests.conftest import VALID_HEADERS


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_tag_course_rejects_missing_key(client: AsyncClient):
    resp = await client.post(
        "/v1/tagging/course",
        json={"title": "Python Basics", "description": "Learn Python from scratch."},
    )
    assert resp.status_code == 422  # missing header → validation error from FastAPI


@pytest.mark.asyncio
async def test_tag_course_rejects_wrong_key(client: AsyncClient):
    resp = await client.post(
        "/v1/tagging/course",
        json={"title": "Python Basics", "description": "Learn Python from scratch."},
        headers={"X-Internal-Api-Key": "wrong-key"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_tag_course_happy_path(client: AsyncClient):
    mock_tags = ["python", "programming", "beginners"]

    with patch(
        "app.api.v1.tagging.generate_tags",
        new=AsyncMock(return_value=mock_tags),
    ):
        resp = await client.post(
            "/v1/tagging/course",
            json={"title": "Python Basics", "description": "Learn Python from scratch."},
            headers=VALID_HEADERS,
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["tags"] == mock_tags


@pytest.mark.asyncio
async def test_tag_course_returns_empty_list_on_llm_error(client: AsyncClient):
    """When the LLM returns something unparseable, the service degrades gracefully."""
    with patch(
        "app.api.v1.tagging.generate_tags",
        new=AsyncMock(return_value=[]),
    ):
        resp = await client.post(
            "/v1/tagging/course",
            json={"title": "Test", "description": "Test description."},
            headers=VALID_HEADERS,
        )

    assert resp.status_code == 200
    assert resp.json()["tags"] == []


@pytest.mark.asyncio
async def test_summarize_lesson_happy_path(client: AsyncClient):
    mock_summary = "• Key point one.\n• Key point two."

    with patch(
        "app.api.v1.summarization.summarize_transcript",
        new=AsyncMock(return_value=mock_summary),
    ):
        resp = await client.post(
            "/v1/summarization/lesson",
            json={"transcript": "This is a long lesson transcript about Python loops..."},
            headers=VALID_HEADERS,
        )

    assert resp.status_code == 200
    assert resp.json()["summary"] == mock_summary


@pytest.mark.asyncio
async def test_study_assistant_happy_path(client: AsyncClient):
    mock_reply = "Great question! In Python, a list is an ordered, mutable collection."

    with patch(
        "app.api.v1.study_assistant.answer_question",
        new=AsyncMock(return_value=mock_reply),
    ):
        resp = await client.post(
            "/v1/study-assistant/chat",
            json={
                "question": "What is a Python list?",
                "course_context": "Python for Beginners",
                "conversation_history": [],
            },
            headers=VALID_HEADERS,
        )

    assert resp.status_code == 200
    assert resp.json()["reply"] == mock_reply


@pytest.mark.asyncio
async def test_study_assistant_multi_turn(client: AsyncClient):
    """Conversation history is forwarded to the service function correctly."""
    captured_args: dict = {}

    async def capture_answer_question(question, course_context, conversation_history):
        captured_args.update(
            question=question,
            course_context=course_context,
            history_length=len(conversation_history),
        )
        return "A tuple is immutable."

    history = [
        {"role": "user", "content": "What is a list?"},
        {"role": "assistant", "content": "A list is mutable."},
    ]

    with patch("app.api.v1.study_assistant.answer_question", new=capture_answer_question):
        resp = await client.post(
            "/v1/study-assistant/chat",
            json={
                "question": "What about a tuple?",
                "conversation_history": history,
            },
            headers=VALID_HEADERS,
        )

    assert resp.status_code == 200
    assert captured_args["history_length"] == 2
    assert captured_args["question"] == "What about a tuple?"
