import asyncio
import os
import sys
import uuid
from typing import List

# Add the current directory to sys.path
sys.path.append(os.getcwd())

from sqlalchemy import select
from app.database import AsyncSessionLocal, engine
from app import models, schemas
from app.services.transcription_service import transcribe_audio
from app.services import search_index

# Configuration for local storage
LOCAL_STORAGE_ROOM_NAME = "Local Audio Storage"
SYSTEM_USER_NAME = "system_local"

async def get_or_create_system_user(db):
    result = await db.execute(select(models.User).where(models.User.username == SYSTEM_USER_NAME))
    user = result.scalars().first()
    if not user:
        user = models.User(
            username=SYSTEM_USER_NAME,
            email="system_local@example.com",
            hashed_password="not-a-password",
            about="System user for local file indexing"
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        print(f"Created system user: {SYSTEM_USER_NAME}")
    return user

async def get_or_create_local_room(db, user_id):
    result = await db.execute(select(models.Room).where(models.Room.name == LOCAL_STORAGE_ROOM_NAME))
    room = result.scalars().first()
    if not room:
        room = models.Room(
            name=LOCAL_STORAGE_ROOM_NAME,
            is_group=True,
            created_by=user_id
        )
        db.add(room)
        await db.commit()
        await db.refresh(room)
        
        # Add system user to the room
        member = models.RoomMember(
            room_id=room.id,
            user_id=user_id,
            is_admin=True
        )
        db.add(member)
        await db.commit()
        print(f"Created local storage room: {LOCAL_STORAGE_ROOM_NAME}")
    return room

async def index_audio_folder(folder_path: str):
    if not os.path.exists(folder_path):
        print(f"Error: Folder {folder_path} does not exist.")
        return

    print(f"Scanning folder: {folder_path}")
    audio_extensions = {'.mp3', '.wav', '.m4a', '.flac', '.ogg', '.aac'}
    audio_files = []
    
    for root, dirs, files in os.walk(folder_path):
        for file in files:
            if os.path.splitext(file)[1].lower() in audio_extensions:
                audio_files.append(os.path.join(root, file))

    print(f"Found {len(audio_files)} audio files.")

    async with AsyncSessionLocal() as db:
        system_user = await get_or_create_system_user(db)
        local_room = await get_or_create_local_room(db, system_user.id)
        
        # Initialize search index
        search_index.initialize()

        for file_path in audio_files:
            # Check if already indexed
            result = await db.execute(
                select(models.Message).where(models.Message.file_path == file_path)
            )
            existing = result.scalars().first()
            if existing:
                print(f"Skipping (already indexed): {file_path}")
                continue

            print(f"Transcribing: {file_path}")
            try:
                # transcribe_audio is async
                text = await transcribe_audio(file_path)
                if not text or text == "[No speech detected]":
                    print(f"No speech detected in {file_path}, skipping indexing.")
                    continue

                # Create message
                message = models.Message(
                    room_id=local_room.id,
                    sender_id=system_user.id,
                    content=os.path.basename(file_path),
                    message_type=models.MessageType.voice,
                    file_path=file_path,
                    transcription=text,
                    is_transcribed=True
                )
                db.add(message)
                await db.commit()
                await db.refresh(message)

                # Add to FAISS index
                search_index.add_embedding(str(message.id), text)
                print(f"Indexed: {file_path}")
            except Exception as e:
                print(f"Failed to process {file_path}: {e}")

    # Save indexes at the end
    search_index._save_index()
    print("Indexing complete.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python index_local_audio.py <folder_path>")
    else:
        path = sys.argv[1]
        asyncio.run(index_audio_folder(path))
