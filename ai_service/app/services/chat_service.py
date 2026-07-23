from openai import AsyncOpenAI
from app.core.config import settings
from app.services.llm_client import get_llm_client

SYSTEM_PROMPT_BASE = """You are an AI study assistant for EduStream, an online learning platform.
Your job is to help learners understand course material. Be concise, accurate, and encouraging.
If you are unsure about something, say so rather than guessing.
Never fabricate facts or invent course content that was not provided to you."""

SYSTEM_PROMPT_WITH_CONTEXT = SYSTEM_PROMPT_BASE + """

You are currently helping a learner with the following course:
{course_context}

Tailor your answers to this course's content and level where relevant."""


async def answer_question(
    question: str,
    course_context: str | None,
    conversation_history: list[dict[str, str]],
) -> str:
    """
    Multi-turn conversation support: the full conversation_history is sent
    on every request (the Node API maintains state client-side and passes
    it back). This keeps the service stateless and horizontally scalable —
    no session storage needed here.
    """
    system_prompt = (
        SYSTEM_PROMPT_WITH_CONTEXT.format(course_context=course_context)
        if course_context
        else SYSTEM_PROMPT_BASE
    )

    client: AsyncOpenAI = get_llm_client()

    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]

    # Limit history to last 10 turns to stay well within context limits
    for turn in conversation_history[-10:]:
        messages.append({"role": turn["role"], "content": turn["content"]})

    messages.append({"role": "user", "content": question})

    response = await client.chat.completions.create(
        model=settings.openai_model,
        messages=messages,  # type: ignore[arg-type]
        max_tokens=600,
        temperature=0.4,
    )
    content = response.choices[0].message.content
    return content.strip() if content else "I'm sorry, I couldn't generate a response. Please try again."
