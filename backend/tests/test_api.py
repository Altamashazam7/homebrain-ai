import json
import logging
from collections.abc import Generator
from datetime import datetime, timedelta

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.database.session import Base, ensure_schema_compatibility, get_db
from app.agents.household_agent import detect_intent
from app.models.plan import HouseholdPlan
from app.schemas.plan import PlanContent, PlanResponse
from app.services.plan_service import save_plan
import main
from main import JsonFormatter

app = main.app

test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(bind=test_engine, autoflush=False, autocommit=False)


def override_get_db() -> Generator[Session, None, None]:
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def clean_database(monkeypatch: pytest.MonkeyPatch) -> Generator[None, None, None]:
    Base.metadata.create_all(bind=test_engine)
    with test_engine.begin() as connection:
        connection.execute(HouseholdPlan.__table__.delete())
    monkeypatch.setattr(settings, "gemini_api_key", "")
    yield


def test_simulated_devices_include_all_ecosystem_brands() -> None:
    response = TestClient(app).get("/api/devices")

    assert response.status_code == 200
    assert {device["name"] for device in response.json()} == {"Alexa+", "Ring", "Fire TV", "Bee"}


def test_application_startup_creates_database_schema(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    Base.metadata.drop_all(bind=test_engine)
    monkeypatch.setattr(main, "engine", test_engine)

    with TestClient(app) as client:
        assert client.get("/api/health").json() == {"status": "ok"}

    assert inspect(test_engine).has_table("household_plans")
    columns = {column["name"] for column in inspect(test_engine).get_columns("household_plans")}
    assert {"ai_summary", "alexa_automations", "intent_category"} <= columns


def test_existing_database_gets_plan_context_columns() -> None:
    legacy_engine = create_engine("sqlite://")
    with legacy_engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE household_plans ("
                "id INTEGER PRIMARY KEY, goal VARCHAR(500) NOT NULL, "
                "security_plan JSON NOT NULL, energy_plan JSON NOT NULL, "
                "entertainment_plan JSON NOT NULL, created_at DATETIME NOT NULL)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO household_plans "
                "(id, goal, security_plan, energy_plan, entertainment_plan, created_at) "
                "VALUES (1, 'Legacy plan', "
                "'[\"Lock doors\", \"Check alerts\"]', "
                "'[\"Turn off lights\", \"Set away mode\"]', "
                "'[\"Queue a watchlist\", \"Pause routines\"]', "
                "'2026-01-01 00:00:00')"
            )
        )

    ensure_schema_compatibility(legacy_engine)

    columns = {column["name"] for column in inspect(legacy_engine).get_columns("household_plans")}
    assert "ai_summary" in columns
    assert "alexa_automations" in columns
    with legacy_engine.connect() as connection:
        legacy_plan = connection.execute(
            text(
                "SELECT ai_summary, alexa_automations, intent_category "
                "FROM household_plans WHERE id = 1"
            )
        ).one()
    assert legacy_plan.ai_summary
    assert len(json.loads(legacy_plan.alexa_automations)) == 3
    assert legacy_plan.intent_category == "general"
    with Session(legacy_engine) as db:
        response = PlanResponse.model_validate(db.get(HouseholdPlan, 1))
    assert len(response.alexa_automations) == 3
    assert response.ai_summary
    assert response.intent_category == "general"
    legacy_engine.dispose()


def test_plan_is_created_and_available_in_history() -> None:
    client = TestClient(app)
    response = client.post("/api/plans", json={"goal": "I am leaving home for 5 days."})

    assert response.status_code == 201
    plan = response.json()
    assert plan["id"] > 0
    assert plan["goal"] == "I am leaving home for 5 days."
    created_at = datetime.fromisoformat(plan["created_at"].replace("Z", "+00:00"))
    assert created_at.utcoffset() == timedelta(0)
    assert len(plan["security_plan"]) >= 2
    assert len(plan["energy_plan"]) >= 2
    assert len(plan["entertainment_plan"]) >= 2
    assert plan["ai_summary"]
    assert plan["intent_category"] == "travel"

    history = client.get("/api/plans")
    assert history.status_code == 200
    assert history.json()[0]["id"] == plan["id"]
    assert history.json()[0]["ai_summary"] == plan["ai_summary"]
    assert history.json()[0]["alexa_automations"] == plan["alexa_automations"]
    assert history.json()[0]["intent_category"] == plan["intent_category"]


def test_plan_rejects_too_short_goal() -> None:
    response = TestClient(app).post("/api/plans", json={"goal": "away"})

    assert response.status_code == 422


def test_plan_rejects_whitespace_only_goal() -> None:
    response = TestClient(app).post("/api/plans", json={"goal": "     "})

    assert response.status_code == 422


def test_plan_normalizes_goal_before_persisting() -> None:
    response = TestClient(app).post(
        "/api/plans",
        json={"goal": "  I am leaving home for 5 days.  "},
    )

    assert response.status_code == 201
    assert response.json()["goal"] == "I am leaving home for 5 days."


def test_gemini_api_key_is_sent_in_header(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.services import gemini_service

    monkeypatch.setattr(settings, "gemini_api_key", "test-api-key")
    captured_request: dict[str, object] = {}

    class MockResponse:
        def raise_for_status(self) -> None:
            pass

        def json(self) -> dict[str, object]:
            return {
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {
                                    "text": json.dumps(
                                        {
                                            "intent_category": "travel",
                                            "security_plan": ["Lock doors", "Check alerts"],
                                            "energy_plan": ["Turn off lights", "Set away mode"],
                                            "entertainment_plan": ["Queue a watchlist", "Pause routines"],
                                            "ai_summary": "Prepare the home for a five-day trip.",
                                            "alexa_automations": [
                                                "Activate Away Mode.",
                                                "Start a varied lighting routine.",
                                                "Schedule a return-home reminder.",
                                            ],
                                        }
                                    )
                                }
                            ]
                        }
                    }
                ]
            }

    class MockClient:
        def __init__(self, **kwargs: object) -> None:
            captured_request.update(kwargs)

        async def __aenter__(self) -> "MockClient":
            return self

        async def __aexit__(self, *_: object) -> None:
            pass

        async def post(self, url: str, **kwargs: object) -> MockResponse:
            captured_request["url"] = url
            captured_request.update(kwargs)
            return MockResponse()

    monkeypatch.setattr(gemini_service.httpx, "AsyncClient", MockClient)

    response = TestClient(app).post(
        "/api/plans",
        json={"goal": "I am leaving home for 5 days."},
    )

    assert response.status_code == 201
    assert captured_request["headers"] == {"x-goog-api-key": "test-api-key"}
    assert "params" not in captured_request
    assert captured_request["timeout"] == 30.0
    generation_config = captured_request["json"]["generationConfig"]
    assert generation_config["responseMimeType"] == "application/json"
    assert set(generation_config["responseSchema"]["required"]) == {
        "intent_category",
        "security_plan",
        "energy_plan",
        "entertainment_plan",
        "ai_summary",
        "alexa_automations",
    }
    assert len(response.json()["alexa_automations"]) == 3
    assert captured_request["json"]["contents"][0]["parts"][0]["text"] == (
        "I am leaving home for 5 days."
    )
    assert "highly specific plan" in captured_request["json"]["systemInstruction"]["parts"][0]["text"]
    assert response.json()["ai_summary"] == "Prepare the home for a five-day trip."
    assert response.json()["intent_category"] == "travel"
    assert set(response.json()) == {
        "id",
        "goal",
        "created_at",
        "security_plan",
        "energy_plan",
        "entertainment_plan",
        "ai_summary",
        "alexa_automations",
        "intent_category",
    }


def test_gemini_timeout_falls_back_to_demo_plan(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.services import gemini_service

    monkeypatch.setattr(settings, "gemini_api_key", "test-api-key")

    class TimeoutClient:
        def __init__(self, **_: object) -> None:
            pass

        async def __aenter__(self) -> "TimeoutClient":
            return self

        async def __aexit__(self, *_: object) -> None:
            pass

        async def post(self, *_: object, **__: object) -> None:
            raise httpx.ReadTimeout("Gemini request timed out")

    monkeypatch.setattr(gemini_service.httpx, "AsyncClient", TimeoutClient)

    response = TestClient(app).post(
        "/api/plans",
        json={"goal": "I am leaving home for 5 days."},
    )

    assert response.status_code == 201
    plan = response.json()
    assert plan["goal"] == "I am leaving home for 5 days."
    assert len(plan["security_plan"]) >= 2
    assert len(plan["energy_plan"]) >= 2
    assert len(plan["entertainment_plan"]) >= 2
    assert plan["ai_summary"]
    assert 3 <= len(plan["alexa_automations"]) <= 5
    assert plan["intent_category"] == "travel"
    assert "newborn" not in plan


def test_unavailable_gemini_fallback_uses_goal_intent() -> None:
    client = TestClient(app)
    goals = [
        "I have a newborn baby and I am sleep deprived.",
        "I am hosting a party for 30 people tomorrow.",
        "I work night shifts and sleep during the day.",
    ]

    plans = [
        client.post("/api/plans", json={"goal": goal}).json()
        for goal in goals
    ]

    summaries = [plan["ai_summary"] for plan in plans]
    assert [plan["intent_category"] for plan in plans] == ["newborn", "event", "work_schedule"]
    assert len(set(summaries)) == 3
    assert "newborn" in plans[0]["ai_summary"].lower()
    assert "guest" in " ".join(plans[1]["security_plan"] + plans[1]["entertainment_plan"]).lower()
    assert "sleep" in " ".join(plans[2]["security_plan"] + plans[2]["energy_plan"]).lower()
    automation_sets = [set(plan["alexa_automations"]) for plan in plans]
    assert all(3 <= len(automations) <= 5 for automations in automation_sets)
    assert len(set.union(*automation_sets)) >= 9
    assert "Night Feed Routine" in plans[0]["alexa_automations"][0]
    assert any("Guest Arrival Routine" in item for item in plans[1]["alexa_automations"])
    assert any("Day Sleep Mode" in item for item in plans[2]["alexa_automations"])
    assert len({tuple(plan[key]) for plan in plans for key in (
        "security_plan",
        "energy_plan",
        "entertainment_plan",
    )}) == 9


@pytest.mark.parametrize(
    ("goal", "intent"),
    [
        ("I am leaving home for a week.", "travel"),
        ("I need help coordinating my family.", "family"),
        ("We have a newborn baby.", "newborn"),
        ("I am hosting a party tomorrow.", "event"),
        ("I work night shifts.", "work_schedule"),
        ("I want to save energy.", "energy_saving"),
        ("I want to improve home security.", "home_security"),
    ],
)
def test_goal_intent_classification(goal: str, intent: str) -> None:
    assert detect_intent(goal) == intent


def test_json_formatter_includes_structured_planning_context() -> None:
    record = logging.LogRecord(
        name="planner",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="Final household plan",
        args=(),
        exc_info=None,
    )
    record.goal = "I have a newborn baby."
    record.detected_intent = "newborn"
    record.gemini_raw_response = '{"intent_category":"newborn"}'
    record.final_json_output = {"ai_summary": "Support newborn care."}

    formatted = json.loads(JsonFormatter().format(record))

    assert formatted["goal"] == "I have a newborn baby."
    assert formatted["detected_intent"] == "newborn"
    assert formatted["gemini_raw_response"] == '{"intent_category":"newborn"}'
    assert formatted["final_json_output"] == {"ai_summary": "Support newborn care."}


def test_failed_database_commit_rolls_back(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = TestSessionLocal()
    rollback_called = False

    def fail_commit() -> None:
        raise RuntimeError("database commit failed")

    def record_rollback() -> None:
        nonlocal rollback_called
        rollback_called = True

    monkeypatch.setattr(db, "commit", fail_commit)
    monkeypatch.setattr(db, "rollback", record_rollback)

    with pytest.raises(RuntimeError, match="database commit failed"):
        save_plan(
            db,
            "I am leaving home for 5 days.",
            PlanContent(
                security_plan=["Lock doors", "Check alerts"],
                energy_plan=["Turn off lights", "Set away mode"],
                entertainment_plan=["Queue a watchlist", "Pause routines"],
                ai_summary="Prepare the home safely.",
                alexa_automations=[
                    "Review the suggested routine before enabling it.",
                    "Keep essential household safety equipment powered.",
                    "Adjust automation timing to fit your household schedule.",
                ],
                intent_category="travel",
            ),
        )

    assert rollback_called
    db.close()
