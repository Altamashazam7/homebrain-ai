from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.device import DeviceStatus
from app.schemas.plan import PlanRequest, PlanResponse
from app.services.device_service import list_devices
from app.services.plan_service import generate_and_save_plan, get_plan_history

router = APIRouter(prefix="/api")


@router.get("/health", tags=["system"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/devices", response_model=list[DeviceStatus], tags=["devices"])
def devices() -> list[DeviceStatus]:
    return list_devices()


@router.post(
    "/plans",
    response_model=PlanResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["plans"],
)
async def create_plan(
    request: PlanRequest,
    db: Session = Depends(get_db),
) -> PlanResponse:
    return await generate_and_save_plan(db, request.goal)


@router.get("/plans", response_model=list[PlanResponse], tags=["plans"])
def plan_history(
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
) -> list[PlanResponse]:
    return get_plan_history(db, limit)
