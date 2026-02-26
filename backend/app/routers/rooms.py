from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload
from typing import List, Optional
import uuid
from app.database import get_db
from app import models, schemas
from app.auth import get_current_user

router = APIRouter(prefix="/api/rooms", tags=["rooms"])


async def _room_with_relations(db: AsyncSession, room_id: uuid.UUID):
    result = await db.execute(
        select(models.Room)
        .options(
            selectinload(models.Room.members).selectinload(models.RoomMember.user),
            selectinload(models.Room.messages).selectinload(models.Message.sender),
        )
        .where(models.Room.id == room_id)
    )
    return result.scalar_one_or_none()


@router.get("", response_model=List[schemas.RoomOut])
async def list_rooms(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    result = await db.execute(
        select(models.Room)
        .join(models.RoomMember, models.RoomMember.room_id == models.Room.id)
        .where(models.RoomMember.user_id == current_user.id)
        .options(
            selectinload(models.Room.members).selectinload(models.RoomMember.user),
            selectinload(models.Room.messages).selectinload(models.Message.sender),
        )
        .order_by(models.Room.created_at.desc())
    )
    rooms = result.scalars().unique().all()

    out = []
    for room in rooms:
        members_out = [schemas.UserOut.model_validate(m.user) for m in room.members]
        last_msg = None
        if room.messages:
            msg = sorted(room.messages, key=lambda m: m.created_at)[-1]
            last_msg = schemas.MessageOut.model_validate(msg)
        # For DMs, name is the other person's username
        name = room.name
        if not room.is_group:
            other = next((m.user for m in room.members if m.user_id != current_user.id), None)
            if other:
                name = other.username
        out.append(schemas.RoomOut(
            id=room.id,
            name=name,
            is_group=room.is_group,
            created_at=room.created_at,
            members=members_out,
            last_message=last_msg,
        ))
    return out


@router.post("", response_model=schemas.RoomOut)
async def create_room(
    data: schemas.RoomCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # For DMs: check if room already exists
    if not data.is_group and len(data.member_ids) == 1:
        other_id = data.member_ids[0]
        existing = await db.execute(
            select(models.Room)
            .join(models.RoomMember, models.RoomMember.room_id == models.Room.id)
            .where(
                models.Room.is_group == False,
                models.RoomMember.user_id == current_user.id,
            )
        )
        for room in existing.scalars().unique().all():
            member_ids = {str(m.user_id) for m in room.members}
            if str(other_id) in member_ids and str(current_user.id) in member_ids:
                full = await _room_with_relations(db, room.id)
                members_out = [schemas.UserOut.model_validate(m.user) for m in full.members]
                other = next((m.user for m in full.members if m.user_id != current_user.id), None)
                return schemas.RoomOut(
                    id=full.id,
                    name=other.username if other else full.name,
                    is_group=full.is_group,
                    created_at=full.created_at,
                    members=members_out,
                )

    room = models.Room(
        name=data.name,
        is_group=data.is_group,
        created_by=current_user.id,
    )
    db.add(room)
    await db.flush()

    all_member_ids = list(set(data.member_ids + [current_user.id]))
    for uid in all_member_ids:
        member = models.RoomMember(
            room_id=room.id,
            user_id=uid,
            is_admin=(uid == current_user.id),
        )
        db.add(member)

    await db.commit()
    full = await _room_with_relations(db, room.id)
    members_out = [schemas.UserOut.model_validate(m.user) for m in full.members]
    other = next((m.user for m in full.members if m.user_id != current_user.id), None)
    name = data.name if data.is_group else (other.username if other else data.name)
    return schemas.RoomOut(
        id=full.id,
        name=name,
        is_group=full.is_group,
        created_at=full.created_at,
        members=members_out,
    )


@router.get("/{room_id}/messages", response_model=List[schemas.MessageOut])
async def get_messages(
    room_id: uuid.UUID,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Verify membership
    membership = await db.execute(
        select(models.RoomMember).where(
            and_(
                models.RoomMember.room_id == room_id,
                models.RoomMember.user_id == current_user.id,
            )
        )
    )
    if not membership.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this room")

    result = await db.execute(
        select(models.Message)
        .options(selectinload(models.Message.sender))
        .where(
            and_(models.Message.room_id == room_id, models.Message.is_deleted == False)
        )
        .order_by(models.Message.created_at.asc())
        .limit(limit)
        .offset(offset)
    )
    return result.scalars().all()


@router.delete("/{room_id}")
async def leave_or_delete_room(
    room_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Leave a room (1-on-1 DMs: delete entirely; groups: just remove self).
    """
    from sqlalchemy import text

    # Verify membership
    membership_result = await db.execute(
        select(models.RoomMember).where(
            and_(
                models.RoomMember.room_id == room_id,
                models.RoomMember.user_id == current_user.id,
            )
        )
    )
    if not membership_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this room")

    # Count members
    count_result = await db.execute(
        select(models.RoomMember).where(models.RoomMember.room_id == room_id)
    )
    members = count_result.scalars().all()

    if len(members) <= 2:
        # Delete entire room — use raw SQL in correct FK order
        await db.execute(text("DELETE FROM messages WHERE room_id = :rid"), {"rid": room_id})
        await db.execute(text("DELETE FROM room_members WHERE room_id = :rid"), {"rid": room_id})
        await db.execute(text("DELETE FROM rooms WHERE id = :rid"), {"rid": room_id})
    else:
        # Just remove self from group
        await db.execute(
            text("DELETE FROM room_members WHERE room_id = :rid AND user_id = :uid"),
            {"rid": room_id, "uid": current_user.id},
        )

    await db.commit()
    return {"status": "ok"}
