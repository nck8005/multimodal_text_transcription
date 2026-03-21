import asyncio
import sys
import os
from typing import List

# Add current dir to path
sys.path.append(os.getcwd())

from app.services import search_index
from app.database import AsyncSessionLocal
from app import models
from sqlalchemy import select

async def quick_search(query: str):
    print(f"\n🔍 Searching for: '{query}'...")
    
    # Initialize FAISS
    search_index.initialize()
    
    # Perform semantic search
    results = search_index.search(query, top_k=5)
    
    if not results:
        print("❌ No matches found in the index.")
        return

    async with AsyncSessionLocal() as db:
        for i, mid in enumerate(results):
            # Fetch message details from DB
            result = await db.execute(
                select(models.Message).where(models.Message.id == mid)
            )
            msg = result.scalars().first()
            if msg:
                print(f"\n[{i+1}] File: {os.path.basename(msg.file_path or 'Unknown')}")
                print(f"    Confidence: High (Semantic Match)")
                print(f"    Snippet: ...{msg.transcription[:150]}...")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python search_local.py \"your search query\"")
    else:
        asyncio.run(quick_search(" ".join(sys.argv[1:])))
