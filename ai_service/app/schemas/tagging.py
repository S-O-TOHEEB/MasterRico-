from pydantic import BaseModel


class TagCourseRequest(BaseModel):
    title: str
    description: str


class TagCourseResponse(BaseModel):
    tags: list[str]
