"""
AI Adapters — provider-agnostic interface for LLM API calls.
Supports Anthropic Claude and OpenAI-compatible APIs.
"""
from abc import ABC, abstractmethod

import httpx


class AIAdapter(ABC):
    """Base adapter for any AI provider."""

    @abstractmethod
    async def chat_completion(self, system: str, user_message: str,
                              max_tokens: int, temperature: float) -> str:
        """Send a prompt and return the text response."""

    @abstractmethod
    async def test_connection(self) -> tuple[bool, str]:
        """Test connection. Returns (success, message)."""


class AnthropicAdapter(AIAdapter):
    """Adapter for Anthropic Claude API (/v1/messages)."""

    def __init__(self, endpoint: str, api_key: str, model: str):
        self.endpoint = endpoint.rstrip("/")
        self.api_key = api_key
        self.model = model

    async def chat_completion(self, system, user_message, max_tokens, temperature):
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{self.endpoint}/v1/messages",
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": self.model,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "system": system,
                    "messages": [{"role": "user", "content": user_message}],
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["content"][0]["text"]

    async def test_connection(self):
        try:
            result = await self.chat_completion(
                system="Respond with exactly: OK",
                user_message="Test",
                max_tokens=10,
                temperature=0,
            )
            return ("OK" in result, f"Model responded: {result[:50]}")
        except Exception as e:
            return (False, str(e))


class OpenAICompatibleAdapter(AIAdapter):
    """Adapter for OpenAI-compatible API (OpenAI, vLLM, Ollama, LocalAI)."""

    def __init__(self, endpoint: str, api_key: str, model: str):
        self.endpoint = endpoint.rstrip("/")
        self.api_key = api_key
        self.model = model

    async def chat_completion(self, system, user_message, max_tokens, temperature):
        headers = {"content-type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{self.endpoint}/v1/chat/completions",
                headers=headers,
                json={
                    "model": self.model,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user_message},
                    ],
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]

    async def test_connection(self):
        try:
            result = await self.chat_completion(
                system="Respond with exactly: OK",
                user_message="Test",
                max_tokens=10,
                temperature=0,
            )
            return ("OK" in result, f"Model responded: {result[:50]}")
        except Exception as e:
            return (False, str(e))


def get_ai_adapter(config) -> AIAdapter | None:
    """Factory: return adapter based on config, or None if AI not configured."""
    if not config or config.provider_type == "none" or not config.is_active:
        return None

    api_key = _decrypt_api_key(config.api_key_encrypted)

    if config.provider_type == "anthropic":
        return AnthropicAdapter(config.api_endpoint, api_key, config.model_name)
    elif config.provider_type == "openai_compatible":
        return OpenAICompatibleAdapter(config.api_endpoint, api_key, config.model_name)
    return None


def encrypt_api_key(plaintext: str) -> bytes:
    """Simple encoding of API key. In production, use proper AES-256 encryption."""
    import base64
    return base64.b64encode(plaintext.encode("utf-8"))


def _decrypt_api_key(encrypted: bytes | None) -> str:
    """Decode API key. In production, use proper AES-256 decryption."""
    if not encrypted:
        return ""
    import base64
    return base64.b64decode(encrypted).decode("utf-8")
