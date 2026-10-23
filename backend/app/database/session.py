import json
from collections.abc import Generator

from sqlalchemy import Engine, create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def ensure_schema_compatibility(database_engine: Engine) -> None:
    if not inspect(database_engine).has_table("household_plans"):
        return
    columns = {column["name"] for column in inspect(database_engine).get_columns("household_plans")}
    with database_engine.begin() as connection:
        if "ai_summary" not in columns:
            connection.execute(
                text(
                    "ALTER TABLE household_plans ADD COLUMN ai_summary "
                    "VARCHAR(500) NOT NULL DEFAULT 'Household plan saved before summaries were available.'"
                )
            )
        connection.execute(
            text(
                "UPDATE household_plans SET ai_summary = "
                "'Household plan saved before summaries were available.' "
                "WHERE ai_summary IS NULL OR ai_summary = ''"
            )
        )
        if "alexa_automations" not in columns:
            connection.execute(
                text("ALTER TABLE household_plans ADD COLUMN alexa_automations JSON NOT NULL DEFAULT '[]'")
            )
            legacy_automations = json.dumps(
                [
                    "Review the suggested routine before enabling it.",
                    "Keep essential household safety equipment powered.",
                    "Adjust automation timing to fit your household schedule.",
                ]
            )
            connection.execute(
                text(
                    "UPDATE household_plans SET alexa_automations = :automations "
                    "WHERE alexa_automations = '[]' OR alexa_automations IS NULL"
                ),
                {"automations": legacy_automations},
            )
        if "intent_category" not in columns:
            connection.execute(
                text("ALTER TABLE household_plans ADD COLUMN intent_category VARCHAR(32) NOT NULL DEFAULT 'general'")
            )


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
