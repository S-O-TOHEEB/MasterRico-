from pydantic import BaseModel, Field
from typing import List


class RecommendationRequest(BaseModel):
    userId: str = Field(..., description="Learner's user ID")
    interests: List[str] = Field(default_factory=list, description="User's declared interests")
    enrolledCourseIds: List[str] = Field(
        default_factory=list,
        description="Course IDs the learner has already enrolled in"
    )
    limit: int = Field(default=10, ge=1, le=50)


class RecommendationResponse(BaseModel):
    recommendedCourseIds: List[str]
    reasoning: str = ""
