from fastapi import APIRouter, Depends
from app.core.security import verify_internal_key
from app.schemas.chat import StudyAssistantRequest, StudyAssistantResponse
from app.services.chat_service import answer_question

router = APIRouter(dependencies=[Depends(verify_internal_key)])


@router.post("/study-assistant/chat", response_model=StudyAssistantResponse)
async def chat(request: StudyAssistantRequest) -> StudyAssistantResponse:
    """
    AI Study Assistant — a Learner Pro perk. The Node API sends the full
    conversation history on every turn (stateless service design); the
    course context comes from the course the learner is currently viewing.
    """
    reply = await answer_question(
        question=request.question,
        course_context=request.course_context,
        conversation_history=[t.model_dump() for t in request.conversation_history],
    )
    return StudyAssistantResponse(reply=reply)
