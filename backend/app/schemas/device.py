from typing import Literal

from pydantic import BaseModel


class DeviceStatus(BaseModel):
    name: str
    category: str
    status: Literal["online", "standby", "attention"]
    detail: str
    battery_percent: int | None = None
