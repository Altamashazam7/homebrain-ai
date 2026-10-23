import logging

import httpx
from pydantic import ValidationError

from app.config import settings
from app.schemas.plan import PlanContent

logger = logging.getLogger(__name__)


class GeminiServiceError(Exception):
    pass


async def generate_with_gemini(goal: str) -> PlanContent | None:
    if not settings.gemini_api_key:
        return None

    endpoint = (
        "https://generativelanguage.googleapis.com/v1beta/"
        f"models/{settings.gemini_model}:generateContent"
    )
    prompt = (
        "You are HomeBrain AI, a practical household planning assistant. "
        "Recommend safe, reversible actions; never claim to control real devices. "
        "Return JSON only with exactly these keys: security_plan, energy_plan, "
        "entertainment_plan. Each value must be an array of 2 to 6 concise strings. "
        "Do not include markdown. User goal: "
        f"{goal}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json"},
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                endpoint,
                headers={"x-goog-api-key": settings.gemini_api_key},
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        plan = PlanContent.model_validate_json(text)
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError, ValidationError) as exc:
        if isinstance(exc, httpx.TimeoutException):
            detail = "Gemini request timed out"
        elif isinstance(exc, httpx.HTTPStatusError):
            detail = f"Gemini returned HTTP {exc.response.status_code}"
        elif isinstance(exc, httpx.HTTPError):
            detail = "Gemini could not be reached"
        elif isinstance(exc, ValidationError):
            detail = "Gemini returned a plan that did not match the required schema"
        elif isinstance(exc, (KeyError, IndexError, TypeError)):
            detail = "Gemini returned an incomplete response"
        else:
            detail = "Gemini returned invalid JSON"
        logger.warning("Gemini plan generation failed: %s", detail, exc_info=exc)
        raise GeminiServiceError(detail) from exc

    logger.info("Generated household plan with Gemini model %s", settings.gemini_model)
    return plan
