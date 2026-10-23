from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PlanRequest(BaseModel):
    goal: str = Field(min_length=5, max_length=500, examples=["I am leaving home for 5 days."])

    @field_validator("goal")
    @classmethod
    def normalize_goal(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 5:
            raise ValueError("Goal must contain at least 5 non-whitespace characters")
        return normalized


class PlanContent(BaseModel):
    security_plan: list[str] = Field(min_length=2, max_length=6)
    energy_plan: list[str] = Field(min_length=2, max_length=6)
    entertainment_plan: list[str] = Field(min_length=2, max_length=6)

    @field_validator("security_plan", "energy_plan", "entertainment_plan")
    @classmethod
    def normalize_recommendations(cls, value: list[str]) -> list[str]:
        recommendations = [item.strip() for item in value]
        if any(not item for item in recommendations):
            raise ValueError("Recommendations must not be empty")
        return recommendations


class PlanResponse(PlanContent):
    id: int
    goal: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_validator("created_at")
    @classmethod
    def normalize_created_at(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
