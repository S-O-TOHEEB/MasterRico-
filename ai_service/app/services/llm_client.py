from openai import AsyncOpenAI
from app.core.config import settings

# Single shared async client. AsyncOpenAI manages its own connection pool
# so this is safe to instantiate once at module load time.
_client: AsyncOpenAI | None = None


def get_llm_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


async def chat_completion(
    system_prompt: str,
    user_message: str,
    max_tokens: int = 512,
    temperature: float = 0.3,
) -> str:
    """
    Thin wrapper so every service in this package calls one function
    rather than constructing messages lists everywhere. Switching models
    or providers means changing settings.openai_model / the client
    base_url, not touching callers.
    """
    client = get_llm_client()
    response = await client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        max_tokens=max_tokens,
        temperature=temperature,
    )
    content = response.choices[0].message.content
    return content.strip() if content else ""
