import os
import uuid
import asyncio
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload
from app.database import get_db
from app import models, schemas
from app.auth import get_current_user
from app.config import get_settings
from app.services import transcription_service, search_index
from app.websocket import broadcast_message

router = APIRouter(prefix="/api/rooms", tags=["messages"])
settings = get_settings()


async def _check_membership(db, room_id, user_id):
    result = await db.execute(
        select(models.RoomMember).where(
            and_(
                models.RoomMember.room_id == room_id,
                models.RoomMember.user_id == user_id,
            )
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this room")


@router.post("/{room_id}/messages", response_model=schemas.MessageOut)
async def send_text_message(
    room_id: uuid.UUID,
    data: schemas.MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    await _check_membership(db, room_id, current_user.id)

    message = models.Message(
        room_id=room_id,
        sender_id=current_user.id,
        content=data.content,
        message_type=models.MessageType.text,
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)

    # Load sender relation
    result = await db.execute(
        select(models.Message)
        .options(selectinload(models.Message.sender))
        .where(models.Message.id == message.id)
    )
    message = result.scalar_one()

    # Add to FAISS index
    search_index.add_embedding(str(message.id), data.content)

    # Broadcast via WebSocket
    msg_out = schemas.MessageOut.model_validate(message)
    await broadcast_message(str(room_id), msg_out.model_dump(mode="json"))

    return message


async def _process_voice(message_id: str, file_path: str, room_id: str, db_session_factory):
    """Background task: transcribe voice and update DB + FAISS."""
    async with db_session_factory() as db:
        try:
            transcription = await transcription_service.transcribe_audio(file_path)
            result = await db.execute(
                select(models.Message)
                .options(selectinload(models.Message.sender))
                .where(models.Message.id == message_id)
            )
            message = result.scalar_one_or_none()
            if message:
                message.transcription = transcription
                message.is_transcribed = True
                await db.commit()
                await db.refresh(message)

                # Index the transcription text
                search_index.add_embedding(str(message.id), transcription)

                # Broadcast update so frontend shows transcription
                msg_out = schemas.MessageOut.model_validate(message)
                await broadcast_message(room_id, {
                    "type": "transcription_update",
                    "message": msg_out.model_dump(mode="json"),
                })
        except Exception as e:
            print(f"Transcription error for {message_id}: {e}")


@router.post("/{room_id}/attachment", response_model=schemas.MessageOut)
async def send_attachment(
    room_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    message_type: models.MessageType = Query(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    await _check_membership(db, room_id, current_user.id)

    # Validate message type
    if message_type not in [models.MessageType.image, models.MessageType.video, models.MessageType.document]:
        raise HTTPException(status_code=400, detail="Invalid attachment type")

    # Save file
    folder_map = {
        models.MessageType.image: "images",
        models.MessageType.video: "videos",
        models.MessageType.document: "docs",
    }
    subfolder = folder_map.get(message_type, "misc")
    upload_dir = os.path.join(settings.upload_dir, subfolder)
    os.makedirs(upload_dir, exist_ok=True)
    
    ext = os.path.splitext(file.filename or "file")[1]
    filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(upload_dir, filename)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    file_url = f"/uploads/{subfolder}/{filename}"

    message = models.Message(
        room_id=room_id,
        sender_id=current_user.id,
        content=file.filename, # For docs/videos, content can be the filename
        message_type=message_type,
        file_path=file_path,
        file_url=file_url,
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)

    result = await db.execute(
        select(models.Message)
        .options(selectinload(models.Message.sender))
        .where(models.Message.id == message.id)
    )
    message = result.scalar_one()

    # Broadcast
    msg_out = schemas.MessageOut.model_validate(message)
    await broadcast_message(str(room_id), msg_out.model_dump(mode="json"))

    # For documents: extract text + index sentences in background
    if message_type == models.MessageType.document:
        from app.database import AsyncSessionLocal
        background_tasks.add_task(
            _process_document,
            str(message.id),
            file_path,
            str(room_id),
            AsyncSessionLocal,
        )

    return message


async def _process_document(message_id: str, file_path: str, room_id: str, db_session_factory):
    """Background task: extract document text, index sentences in FAISS."""
    from app.services import document_service
    async with db_session_factory() as db:
        try:
            # Extract text
            text = document_service.extract_text(file_path)
            if not text.strip():
                print(f"[DocIndex] No text extracted from {file_path}")
                return

            # Split into sentences and index
            sentences = document_service.split_sentences(text)
            search_index.add_document_sentences(message_id, sentences)

            # Store full text as transcription for keyword search
            result = await db.execute(
                select(models.Message)
                .options(selectinload(models.Message.sender))
                .where(models.Message.id == message_id)
            )
            message = result.scalar_one_or_none()
            if message:
                message.transcription = text[:4000]   # cap to avoid huge DB values
                message.is_transcribed = True
                await db.commit()
                await db.refresh(message)

                # Broadcast so frontend knows indexing is done
                msg_out = schemas.MessageOut.model_validate(message)
                await broadcast_message(room_id, {
                    "type": "transcription_update",
                    "message": msg_out.model_dump(mode="json"),
                })
                print(f"[DocIndex] Indexed {len(sentences)} sentences for message {message_id}")
        except Exception as e:
            print(f"[DocIndex] Error processing document {message_id}: {e}")


@router.post("/{room_id}/voice", response_model=schemas.MessageOut)
async def send_voice_message(
    room_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    await _check_membership(db, room_id, current_user.id)

    # Save file
    upload_dir = os.path.join(settings.upload_dir, "voice")
    os.makedirs(upload_dir, exist_ok=True)
    ext = os.path.splitext(file.filename or "audio.webm")[1] or ".webm"
    filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(upload_dir, filename)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    file_url = f"/uploads/voice/{filename}"

    message = models.Message(
        room_id=room_id,
        sender_id=current_user.id,
        content=None,
        message_type=models.MessageType.voice,
        file_path=file_path,
        file_url=file_url,
        is_transcribed=False,
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)

    result = await db.execute(
        select(models.Message)
        .options(selectinload(models.Message.sender))
        .where(models.Message.id == message.id)
    )
    message = result.scalar_one()

    # Broadcast immediately (without transcription)
    msg_out = schemas.MessageOut.model_validate(message)
    await broadcast_message(str(room_id), msg_out.model_dump(mode="json"))

    # Schedule transcription in background
    from app.database import AsyncSessionLocal
    background_tasks.add_task(
        _process_voice,
        str(message.id),
        file_path,
        str(room_id),
        AsyncSessionLocal,
    )

    return message


@router.delete("/{room_id}/messages/{message_id}")
async def delete_message(
    room_id: uuid.UUID,
    message_id: uuid.UUID,
    scope: str = Query("me", regex="^(me|everyone)$"),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    await _check_membership(db, room_id, current_user.id)

    result = await db.execute(
        select(models.Message).where(
            and_(models.Message.id == message_id, models.Message.room_id == room_id)
        )
    )
    message = result.scalar_one_or_none()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    if scope == "everyone":
        if str(message.sender_id) != str(current_user.id):
            raise HTTPException(status_code=403, detail="Only the sender can delete for everyone")
        message.is_deleted = True
        message.content = None
        await db.commit()
        await broadcast_message(str(room_id), {
            "type": "message_deleted",
            "message_id": str(message_id),
            "scope": "everyone",
        })
    else:
        # Delete for me: store as comma-separated user IDs in deleted_for column
        deleted_for_raw = message.deleted_for or ""
        deleted_for = set(deleted_for_raw.split(",")) if deleted_for_raw else set()
        deleted_for.discard("")
        deleted_for.add(str(current_user.id))
        message.deleted_for = ",".join(deleted_for)
        await db.commit()

    return {"status": "ok"}
