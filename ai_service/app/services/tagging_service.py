import json
import re
from app.services.llm_client import chat_completion

SYSTEM_PROMPT = """You are an expert online-learning curator. Given a course title and description,
return a JSON array of 3–8 short, lowercase, hyphen-separated topic tags that a learner would search
for to find this course. Tags should be specific but broadly useful (e.g. "python", "data-analysis",
"machine-learning"). Return ONLY the JSON array — no explanation, no markdown fences."""


async def generate_tags(title: str, description: str) -> list[str]:
    user_message = f"Title: {title}\n\nDescription: {description}"
    raw = await chat_completion(
        system_prompt=SYSTEM_PROMPT,
        user_message=user_message,
        max_tokens=150,
        temperature=0.2,
    )

    # Strip any accidental markdown fences the model may add despite instructions
    cleaned = re.sub(r"```(?:json)?|```", "", raw).strip()

    try:
        tags = json.loads(cleaned)
        if not isinstance(tags, list):
            return []
        return [str(t).lower().strip() for t in tags if isinstance(t, str) and t.strip()]
    except json.JSONDecodeError:
        # If the model returns something un-parseable, return empty rather
        # than crashing — the Node TagCourse job handles an empty list gracefully.
        return []
