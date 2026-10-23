from sqlalchemy import desc, select
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.agents.household_agent import create_household_plan
from app.models.plan import HouseholdPlan
from app.schemas.plan import PlanContent, PlanResponse


async def generate_and_save_plan(db: Session, goal: str) -> PlanResponse:
    content = await create_household_plan(goal)
    return await run_in_threadpool(save_plan, db, goal, content)


def save_plan(db: Session, goal: str, content: PlanContent) -> PlanResponse:
    plan = HouseholdPlan(
        goal=goal,
        security_plan=content.security_plan,
        energy_plan=content.energy_plan,
        entertainment_plan=content.entertainment_plan,
    )
    try:
        db.add(plan)
        db.commit()
        db.refresh(plan)
    except Exception:
        db.rollback()
        raise
    return PlanResponse.model_validate(plan)


def get_plan_history(db: Session, limit: int) -> list[PlanResponse]:
    plans = db.scalars(
        select(HouseholdPlan).order_by(desc(HouseholdPlan.created_at), desc(HouseholdPlan.id)).limit(limit)
    ).all()
    return [PlanResponse.model_validate(plan) for plan in plans]
