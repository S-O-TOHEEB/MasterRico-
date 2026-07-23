from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Internal auth — must match AI_SERVICE_API_KEY in the Node API's .env
    internal_api_key: str

    # LLM backend
    llm_provider: str = "openai"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    # Server
    ai_service_port: int = 8000
    log_level: str = "info"


settings = Settings()
