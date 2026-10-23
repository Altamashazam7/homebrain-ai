import json
from collections.abc import Generator
from datetime import datetime, timedelta

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.database.session import Base, get_db
from app.models.plan import HouseholdPlan
from app.schemas.plan import PlanContent
from app.services.plan_service import save_plan
import main

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

    history = client.get("/api/plans")
    assert history.status_code == 200
    assert history.json()[0]["id"] == plan["id"]


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
                                            "security_plan": ["Lock doors", "Check alerts"],
                                            "energy_plan": ["Turn off lights", "Set away mode"],
                                            "entertainment_plan": ["Queue a watchlist", "Pause routines"],
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
    assert captured_request["json"]["generationConfig"] == {"responseMimeType": "application/json"}


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
            ),
        )

    assert rollback_called
    db.close()
