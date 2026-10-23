from app.schemas.device import DeviceStatus


def list_devices() -> list[DeviceStatus]:
    return [
        DeviceStatus(
            name="Alexa+",
            category="voice assistant",
            status="online",
            detail="Ready for routines and household requests",
        ),
        DeviceStatus(
            name="Ring",
            category="home security",
            status="online",
            detail="Camera simulation active · last check just now",
        ),
        DeviceStatus(
            name="Fire TV",
            category="entertainment",
            status="standby",
            detail="On standby · 3 items in your demo watchlist",
        ),
        DeviceStatus(
            name="Bee",
            category="home assistant",
            status="online",
            detail="Household checklist ready",
            battery_percent=86,
        ),
    ]
