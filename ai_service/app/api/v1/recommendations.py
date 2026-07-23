from fastapi import APIRouter, Depends
from app.core.security import verify_internal_key
from app.schemas.recommendation import RecommendationRequest, RecommendationResponse
from app.services.recommendation_service import generate_recommendations

router = APIRouter(dependencies=[Depends(verify_internal_key)])


@router.post("/recommendations", response_model=RecommendationResponse)
async def get_recommendations(request: RecommendationRequest) -> RecommendationResponse:
    """
    Generate personalised course recommendations for a learner.

    Called by the Node backend's SearchService when a logged-in user requests
    /api/v1/search/recommendations. The Node API passes enrolled course IDs
    and the learner's declared interests; this endpoint uses an LLM to rank
    candidate courses from the database snapshot provided.

    Note: This endpoint currently expects the Node backend to resolve candidate
    courses and pass them in the request. A future version will query an
    internal course cache directly.
    """
    # candidateCourses is optional in the request — if not provided, the
    # Node backend will use its own fallback logic.
    candidate_courses = getattr(request, "candidateCourses", []) or []

    result = await generate_recommendations(
        interests=request.interests,
        enrolled_ids=request.enrolledCourseIds,
        candidate_courses=candidate_courses,
        limit=request.limit,
    )
    return RecommendationResponse(
        recommendedCourseIds=result["recommendedCourseIds"],
        reasoning=result["reasoning"],
    )
