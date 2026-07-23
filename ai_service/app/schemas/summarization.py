from pydantic import BaseModel


class SummarizeLessonRequest(BaseModel):
    transcript: str


class SummarizeLessonResponse(BaseModel):
    summary: str
