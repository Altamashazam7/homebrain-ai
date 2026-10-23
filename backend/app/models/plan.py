from datetime import datetime

from sqlalchemy import DateTime, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class HouseholdPlan(Base):
    __tablename__ = "household_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    goal: Mapped[str] = mapped_column(String(500), nullable=False)
    security_plan: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    energy_plan: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    entertainment_plan: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
