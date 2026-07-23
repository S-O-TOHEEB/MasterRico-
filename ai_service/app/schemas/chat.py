from pydantic import BaseModel
from typing import Literal


class ConversationTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class StudyAssistantRequest(BaseModel):
    question: str
    course_context: str | None = None
    conversation_history: list[ConversationTurn] = []


class StudyAssistantResponse(BaseModel):
    reply: str
