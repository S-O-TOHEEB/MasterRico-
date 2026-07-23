from fastapi import APIRouter, Depends
from app.core.security import verify_internal_key
from app.schemas.summarization import SummarizeLessonRequest, SummarizeLessonResponse
from app.services.summarization_service import summarize_transcript

router = APIRouter(dependencies=[Depends(verify_internal_key)])


@router.post("/summarization/lesson", response_model=SummarizeLessonResponse)
async def summarize_lesson(request: SummarizeLessonRequest) -> SummarizeLessonResponse:
    """
    Summarises a lesson transcript into study-note-style bullet points.
    Called by the Node API's GenerateAiSummary BullMQ job when a transcript
    is available. The summary is stored on the lesson row and shown in the
    learner's lesson view.
    """
    summary = await summarize_transcript(request.transcript)
    return SummarizeLessonResponse(summary=summary)
