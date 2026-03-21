import os
from dotenv import load_dotenv
load_dotenv()
print(f"DATABASE_URL from os.environ: {os.environ.get('DATABASE_URL')}")

from app.config import get_settings
settings = get_settings()
print(f"DATABASE_URL from settings: {settings.database_url}")
