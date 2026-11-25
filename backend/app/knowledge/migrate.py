"""Apply schema.sql. Run once: cd backend && uv run python -m app.knowledge.migrate"""

import asyncio
from pathlib import Path

from sqlalchemy import text

from app.knowledge.db import engine


async def main() -> None:
    sql = Path(__file__).with_name("schema.sql").read_text()
    async with engine.begin() as conn:
        for statement in (s.strip() for s in sql.split(";\n")):
            if statement and not statement.startswith("--"):
                await conn.execute(text(statement))
    print("schema applied")


if __name__ == "__main__":
    asyncio.run(main())
