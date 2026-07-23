import json
import re
from typing import List
from app.services.llm_client import chat_completion

SYSTEM_PROMPT = """You are an expert learning advisor for EduStream, a video-first education platform.

Given a learner's declared interests and list of already-enrolled course IDs, return a JSON object with:
- "recommendedCourseIds": an ordered list of course IDs from the candidates list that best match the learner
- "reasoning": one sentence explaining the selection logic

Return ONLY valid JSON — no markdown, no explanation outside the JSON.

Example output:
{"recommendedCourseIds": ["id-1", "id-3"], "reasoning": "Selected courses that build on Python foundations."}
"""


async def generate_recommendations(
    interests: List[str],
    enrolled_ids: List[str],
    candidate_courses: List[dict],
    limit: int = 10,
) -> dict:
    """
    candidate_courses: list of dicts with id, title, description, tags, averageRating
    """
    if not candidate_courses:
        return {"recommendedCourseIds": [], "reasoning": "No candidate courses available."}

    user_message = (
        f"Learner interests: {', '.join(interests) or 'not specified'}\n"
        f"Already enrolled in: {', '.join(enrolled_ids) or 'none'}\n\n"
        "Available courses (pick up to {limit} best matches in order):\n"
        + "\n".join(
            f"- ID: {c['id']} | Title: {c['title']} | Tags: {', '.join(c.get('tags', []))} | Rating: {c.get('averageRating', 0)}"
            for c in candidate_courses[:40]  # Cap candidates sent to LLM
        )
    ).replace("{limit}", str(limit))

    raw = await chat_completion(
        system_prompt=SYSTEM_PROMPT,
        user_message=user_message,
        max_tokens=400,
        temperature=0.3,
    )

    cleaned = re.sub(r"```(?:json)?|```", "", raw).strip()

    try:
        result = json.loads(cleaned)
        ids = result.get("recommendedCourseIds", [])
        # Safety: only return IDs that actually exist in the candidates
        valid_ids = {c["id"] for c in candidate_courses}
        filtered = [i for i in ids if i in valid_ids][:limit]
        return {
            "recommendedCourseIds": filtered,
            "reasoning": result.get("reasoning", ""),
        }
    except (json.JSONDecodeError, KeyError):
        # Fallback: return top-rated candidates
        sorted_candidates = sorted(
            candidate_courses, key=lambda c: c.get("averageRating", 0), reverse=True
        )
        return {
            "recommendedCourseIds": [c["id"] for c in sorted_candidates[:limit]],
            "reasoning": "Fallback: sorted by rating.",
        }
