from app.services.llm_client import chat_completion

SYSTEM_PROMPT = """You are an expert instructional designer. Summarise the following lesson transcript
in 3–5 bullet points. Each bullet should be a complete sentence that a learner could use as a study note.
Start each bullet with "•". Do not add a title or any other content."""


async def summarize_transcript(transcript: str) -> str:
    # Trim very long transcripts to avoid exceeding context limits.
    # A real implementation would chunk and summarise-then-reduce.
    truncated = transcript[:12_000] if len(transcript) > 12_000 else transcript

    summary = await chat_completion(
        system_prompt=SYSTEM_PROMPT,
        user_message=truncated,
        max_tokens=400,
        temperature=0.2,
    )
    return summary
