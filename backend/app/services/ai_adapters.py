"""
AI Adapters — provider-agnostic interface for LLM API calls.
Supports Anthropic Claude and OpenAI-compatible APIs.
Returns both text content and usage metadata (tokens, cost).
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from decimal import Decimal

import httpx

# ── Pricing per 1M tokens (USD) ──
_PRICING: dict[str, tuple[float, float]] = {
    # model_prefix: (input_per_1M, output_per_1M)
    # Anthropic
    "claude-opus-4": (15.0, 75.0),
    "claude-sonnet-4": (3.0, 15.0),
    "claude-3-5-sonnet": (3.0, 15.0),
    "claude-3-5-haiku": (0.80, 4.0),
    "claude-3-opus": (15.0, 75.0),
    "claude-3-sonnet": (3.0, 15.0),
    "claude-3-haiku": (0.25, 1.25),
    # OpenAI
    "gpt-4o": (2.50, 10.0),
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4-turbo": (10.0, 30.0),
    "gpt-4": (30.0, 60.0),
    "gpt-3.5-turbo": (0.50, 1.50),
    "o1": (15.0, 60.0),
    "o1-mini": (3.0, 12.0),
    "o3-mini": (1.10, 4.40),
}


def _estimate_cost(model: str, tokens_in: int, tokens_out: int) -> Decimal:
    """Estimate cost based on model name prefix matching."""
    model_lower = model.lower()
    for prefix, (in_price, out_price) in _PRICING.items():
        if model_lower.startswith(prefix):
            cost = (tokens_in * in_price + tokens_out * out_price) / 1_000_000
            return Decimal(str(round(cost, 6)))
    return Decimal("0")


@dataclass
class LLMResponse:
    """Response from LLM with text and usage metadata."""
    text: str
    tokens_input: int = 0
    tokens_output: int = 0
    cost_usd: Decimal = field(default_factory=lambda: Decimal("0"))
    model: str = ""


class AIAdapter(ABC):
    """Base adapter for any AI provider."""

    @abstractmethod
    async def chat_completion(self, system: str, user_message: str,
                              max_tokens: int, temperature: float,
                              timeout: int = 120) -> LLMResponse:
        """Send a prompt and return structured response with usage data."""

    @abstractmethod
    async def test_connection(self) -> tuple[bool, str]:
        """Test connection. Returns (success, message)."""


class AnthropicAdapter(AIAdapter):
    """Adapter for Anthropic Claude API (/v1/messages)."""

    def __init__(self, endpoint: str, api_key: str, model: str):
        self.endpoint = endpoint.rstrip("/")
        self.api_key = api_key
        self.model = model

    async def chat_completion(self, system, user_message, max_tokens, temperature,
                              timeout=120):
        async with httpx.AsyncClient(timeout=timeout) as client:
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

            content = data.get("content") or []
            if not content:
                raise ValueError(
                    f"Anthropic API zwróciło pustą odpowiedź "
                    f"(stop_reason={data.get('stop_reason', '?')})"
                )
            text = content[0].get("text", "")
            usage = data.get("usage", {})
            tokens_in = usage.get("input_tokens", 0)
            tokens_out = usage.get("output_tokens", 0)
            model_used = data.get("model", self.model)

            return LLMResponse(
                text=text,
                tokens_input=tokens_in,
                tokens_output=tokens_out,
                cost_usd=_estimate_cost(model_used, tokens_in, tokens_out),
                model=model_used,
            )

    async def test_connection(self):
        try:
            result = await self.chat_completion(
                system="Respond with exactly: OK",
                user_message="Test",
                max_tokens=10,
                temperature=0,
                timeout=30,
            )
            return ("OK" in result.text, f"Model responded: {result.text[:50]}")
        except Exception as e:
            return (False, str(e))


class OpenAICompatibleAdapter(AIAdapter):
    """Adapter for OpenAI-compatible API (OpenAI, vLLM, Ollama, LocalAI)."""

    def __init__(self, endpoint: str, api_key: str, model: str):
        self.endpoint = endpoint.rstrip("/")
        self.api_key = api_key
        self.model = model

    async def chat_completion(self, system, user_message, max_tokens, temperature,
                              timeout=120):
        headers = {"content-type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        async with httpx.AsyncClient(timeout=timeout) as client:
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

            choices = data.get("choices") or []
            if not choices:
                raise ValueError(
                    f"OpenAI API zwróciło pustą odpowiedź "
                    f"(finish_reason=brak choices)"
                )
            text = choices[0].get("message", {}).get("content", "")
            usage = data.get("usage", {})
            tokens_in = usage.get("prompt_tokens", 0)
            tokens_out = usage.get("completion_tokens", 0)
            model_used = data.get("model", self.model)

            return LLMResponse(
                text=text,
                tokens_input=tokens_in,
                tokens_output=tokens_out,
                cost_usd=_estimate_cost(model_used, tokens_in, tokens_out),
                model=model_used,
            )

    async def test_connection(self):
        try:
            result = await self.chat_completion(
                system="Respond with exactly: OK",
                user_message="Test",
                max_tokens=10,
                temperature=0,
                timeout=30,
            )
            return ("OK" in result.text, f"Model responded: {result.text[:50]}")
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
