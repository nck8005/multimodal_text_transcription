import asyncio
import sys
import os

# Add the current directory to sys.path so we can import app
sys.path.append(os.getcwd())

from sqlalchemy import text
from app.database import engine

async def fix_enum():
    async with engine.begin() as conn:
        print("Checking PostgreSQL Enum 'messagetype'...")
        try:
            # PostgreSQL doesn't allow ALTER TYPE ... ADD VALUE inside a transaction block easily
            # But SQLAlchemy's begin() handles it if we use independent transactions or just execute
            # We'll use the plain execute to add 'document' if it doesn't exist
            await conn.execute(text("COMMIT")) # Break out of implicit transaction if needed
            await conn.execute(text("ALTER TYPE messagetype ADD VALUE 'document'"))
            print("Successfully added 'document' to messagetype enum.")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("'document' already exists in messagetype enum.")
            else:
                print(f"Error updating enum: {e}")

if __name__ == "__main__":
    asyncio.run(fix_enum())
