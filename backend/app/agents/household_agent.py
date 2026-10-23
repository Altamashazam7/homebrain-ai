import logging
import re

from app.schemas.plan import IntentCategory, PlanContent
from app.services.gemini_service import GeminiServiceError, generate_with_gemini

logger = logging.getLogger(__name__)


def detect_intent(goal: str) -> IntentCategory:
    normalized = goal.casefold()
    intent_patterns: tuple[tuple[IntentCategory, tuple[str, ...]], ...] = (
        (
            "newborn",
            ("newborn", "new baby", "infant", "just gave birth", "baby is", "feeding the baby"),
        ),
        ("event", ("party", "hosting", "host a", "guests", "gathering", "celebration", "dinner party")),
        (
            "work_schedule",
            (
                "night shift",
                "night shifts",
                "work nights",
                "shift work",
                "work schedule",
                "overnight shift",
                "sleep during the day",
                "daytime sleep",
            ),
        ),
        ("travel", ("travel", "trip", "vacation", "holiday", "leaving home", "away for")),
        ("home_security", ("security", "break-in", "burglary", "door lock", "camera", "safety")),
        ("energy_saving", ("save energy", "lower energy", "electricity bill", "energy use", "power consumption")),
        ("family", ("family", "children", "kids", "parents", "caregiving", "school run")),
    )
    for intent, phrases in intent_patterns:
        if any(phrase in normalized for phrase in phrases):
            return intent
    return "general"


def _contextual_fallback(goal: str, intent: IntentCategory) -> PlanContent:
    duration_match = re.search(r"\b(\d{1,3})\s+days?\b", goal, flags=re.IGNORECASE)
    duration = f"the next {duration_match.group(1)} days" if duration_match else "this time"
    plans: dict[IntentCategory, tuple[str, list[str], list[str], list[str], list[str]]] = {
        "newborn": (
            "Prioritize a safe, calm home routine that supports newborn care and caregiver rest.",
            [
                "Keep the baby's sleep space clear, flat, and separate from loose blankets or soft items.",
                "Agree on a clear caregiver handoff for feeds and overnight checks so no task is missed.",
            ],
            [
                "Use comfortable room lighting and temperature without placing portable heaters near the sleep space.",
                "Run only essential appliances during overnight feeds and use efficient, low-heat lighting.",
            ],
            [
                "Prepare quiet, low-volume audio for feeding and settling times.",
                "Keep a short list of calm activities nearby for a rested caregiver during contact naps or feeds.",
            ],
            [
                "Enable Night Feed Routine with a dim-light reminder and a quiet checklist.",
                "Activate Quiet Hours Mode to reduce non-essential household notifications.",
                "Start White Noise Scene at a caregiver-selected volume and duration.",
            ],
        ),
        "event": (
            "Prepare for hosting by keeping guest access, comfort, and the event flow manageable.",
            [
                "Choose one monitored guest entrance and keep private rooms and valuables secured.",
                "Keep exit paths clear and make the location of first-aid supplies easy for hosts to find.",
            ],
            [
                "Pre-cool the gathering space shortly before guests arrive instead of cooling an empty room all day.",
                "Use task lighting in occupied areas and switch off lights in unused rooms.",
            ],
            [
                "Set up a playlist and a simple activity suited to a group of guests.",
                "Plan a quieter area where guests can step away from music and conversation.",
            ],
            [
                "Activate Guest Arrival Routine with a reminder to check the entry area.",
                "Enable Smart Lighting Scene for occupied gathering spaces.",
                "Start Music Queue with a host-selected playlist at a comfortable volume.",
            ],
        ),
        "work_schedule": (
            "Protect daytime sleep around night shifts while keeping the home secure and quiet.",
            [
                "Use a consistent lock-up routine before sleeping and silence non-urgent entry notifications.",
                "Let household members know the protected sleep window so deliveries and visitors do not interrupt it.",
            ],
            [
                "Close blinds and use efficient lighting only in rooms occupied during daytime hours.",
                "Adjust cooling or heating for the sleep window rather than conditioning the entire home all day.",
            ],
            [
                "Queue quiet, low-stimulation audio or a familiar show for the post-shift wind-down.",
                "Schedule entertainment and household routines outside the daytime sleep window.",
            ],
            [
                "Activate Day Sleep Mode during the household's selected rest window.",
                "Silence Non-Essential Alerts while keeping urgent safety notifications enabled.",
                "Adjust Bedroom Comfort Settings before the planned sleep period.",
            ],
        ),
        "travel": (
            f"Prepare the home for an absence over {duration}, with a safe return-home checklist.",
            [
                "Lock doors and windows, and ask a trusted contact to collect deliveries while you are away.",
                "Use a realistic lighting schedule without publicly announcing travel dates.",
            ],
            [
                "Turn off nonessential lights and unplug devices that do not need standby power.",
                "Keep refrigeration and any essential medical or safety equipment powered.",
            ],
            [
                "Save a short watchlist or reading list for the return journey.",
                "Pause nonessential household entertainment routines while away.",
            ],
            [
                "Activate Away Mode at the household's chosen departure time.",
                "Start a varied lighting routine while avoiding a predictable schedule.",
                "Send a return-home reminder to review paused household routines.",
            ],
        ),
        "home_security": (
            "Focus on practical, reversible steps that strengthen everyday home security.",
            [
                "Check that exterior doors and accessible windows close and lock properly.",
                "Review camera and entry-alert settings, and share access only with trusted household members.",
            ],
            [
                "Use motion or scheduled lighting where appropriate instead of leaving every light on.",
                "Keep security equipment powered while switching off unrelated standby devices.",
            ],
            [
                "Set a household check-in routine that does not reveal security details publicly.",
                "Keep a calm indoor activity ready so security checks do not disrupt the evening.",
            ],
            [
                "Start a Door Check Reminder when the household begins its evening routine.",
                "Enable Entry Alert Review at a time chosen by the household.",
                "Activate Occupied Lighting Scene for commonly used rooms.",
            ],
        ),
        "energy_saving": (
            "Reduce avoidable household energy use without compromising comfort or safety.",
            [
                "Keep essential safety equipment and appliances powered while checking for unused devices.",
                "Use scheduled lighting in occupied areas rather than leaving rooms lit unnecessarily.",
            ],
            [
                "Adjust the thermostat modestly when rooms are empty and avoid large temperature swings.",
                "Run full laundry or dishwasher loads during an off-peak period if your utility offers one.",
            ],
            [
                "Choose low-energy activities such as reading, board games, or downloaded content.",
                "Use one shared entertainment area instead of powering several screens in empty rooms.",
            ],
            [
                "Enable Energy Saver Reminder when commonly unused rooms are vacant.",
                "Start a Shared Room Scene that groups lighting around the occupied area.",
                "Schedule a nightly reminder to switch off nonessential devices.",
            ],
        ),
        "family": (
            "Coordinate household routines so family members know what needs attention and when.",
            [
                "Agree on a simple check-in and handoff routine for household responsibilities.",
                "Keep medicines, cleaning products, and other hazards secured away from children.",
            ],
            [
                "Switch off lights and devices in rooms the family has finished using.",
                "Keep the home at a comfortable setting for family members who are present.",
            ],
            [
                "Choose an activity that works for the household's ages and available energy.",
                "Set aside a shared screen-free period for conversation or a family game.",
            ],
            [
                "Start Family Evening Routine with a reminder for shared household tasks.",
                "Enable Homework or Quiet Time Mode during the family's chosen schedule.",
                "Set a Family Wind-Down reminder before bedtime.",
            ],
        ),
        "general": (
            "Turn the stated household goal into a few practical, safe steps.",
            [
                "Check that the main entry is secured and household alerts are set to a useful level.",
                "Keep exits and walkways clear and share important household tasks with the right person.",
            ],
            [
                "Switch off lights and appliances that are not needed.",
                "Keep essential safety, food-storage, and medical equipment powered.",
            ],
            [
                "Choose one relaxing activity that fits the time and people available.",
                "Set aside a short break from screens for a simple household activity.",
            ],
            [
                "Start a Household Welcome Routine at a time chosen by the household.",
                "Enable an Evening Comfort Scene for the rooms in use.",
                "Set a reminder to review optional routines before enabling them.",
            ],
        ),
    }
    summary, security, energy, entertainment, automations = plans[intent]
    return PlanContent(
        security_plan=security,
        energy_plan=energy,
        entertainment_plan=entertainment,
        ai_summary=summary,
        alexa_automations=automations,
        intent_category=intent,
    )


async def create_household_plan(goal: str) -> PlanContent:
    logger.info("Household planning request", extra={"goal": goal})
    fallback_intent = detect_intent(goal)
    raw_response: str | None = None
    try:
        gemini_result = await generate_with_gemini(goal)
    except GeminiServiceError as exc:
        logger.warning("Gemini unavailable; using intent-aware fallback: %s", exc)
        gemini_result = None

    if gemini_result is not None:
        gemini_plan, raw_response = gemini_result
        intent = gemini_plan.intent_category
        plan = PlanContent.model_validate(gemini_plan.model_dump())
        source = "gemini"
    else:
        intent = fallback_intent
        plan = _contextual_fallback(goal, intent)
        source = "intent_aware_fallback"

    logger.info("Household intent detected", extra={"goal": goal, "detected_intent": intent})
    logger.info(
        "Final household plan",
        extra={
            "goal": goal,
            "detected_intent": intent,
            "gemini_raw_response": raw_response,
            "final_json_output": plan.model_dump(mode="json"),
            "generation_source": source,
        },
    )
    return plan
