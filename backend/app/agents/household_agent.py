import logging
import re

from app.schemas.plan import PlanContent
from app.services.gemini_service import GeminiServiceError, generate_with_gemini

logger = logging.getLogger(__name__)


def _demo_plan(goal: str) -> PlanContent:
    match = re.search(r"\b(\d{1,3})\s+days?\b", goal, flags=re.IGNORECASE)
    duration = f"the next {match.group(1)} days" if match else "your time away"
    return PlanContent(
        security_plan=[
            f"Ask Alexa+ to start a lived-in lighting routine during {duration}.",
            "Use the Ring simulation to review entry alerts and confirm the front door is locked before leaving.",
            "Ask a trusted neighbor to collect deliveries and keep an eye on the home.",
        ],
        energy_plan=[
            f"Set the simulated thermostat to an energy-saving away temperature for {duration}.",
            "Turn off nonessential lights and unplug devices that do not need standby power.",
            "Keep refrigeration and any essential medical or safety equipment powered.",
        ],
        entertainment_plan=[
            "Queue a Fire TV watchlist for your return and enable a simulated away profile.",
            "Ask Alexa+ to pause recurring audio and entertainment routines while you are away.",
            "Use Bee for a simple return-home checklist: restore comfort settings and choose something to watch.",
        ],
    )


async def create_household_plan(goal: str) -> PlanContent:
    try:
        ai_plan = await generate_with_gemini(goal)
    except GeminiServiceError as exc:
        logger.warning("Gemini unavailable; using demo plan: %s", exc)
        return _demo_plan(goal)
    return ai_plan if ai_plan is not None else _demo_plan(goal)
