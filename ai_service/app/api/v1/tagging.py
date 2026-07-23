from fastapi import APIRouter, Depends
from app.core.security import verify_internal_key
from app.schemas.tagging import TagCourseRequest, TagCourseResponse
from app.services.tagging_service import generate_tags

router = APIRouter(dependencies=[Depends(verify_internal_key)])


@router.post("/tagging/course", response_model=TagCourseResponse)
async def tag_course(request: TagCourseRequest) -> TagCourseResponse:
    """
    Generates topic tags for a course. Called by the Node API's TagCourse
    BullMQ job after a course is published. Runs out of the request path —
    a slow LLM call here never blocks a creator's publish action.
    """
    tags = await generate_tags(title=request.title, description=request.description)
    return TagCourseResponse(tags=tags)
