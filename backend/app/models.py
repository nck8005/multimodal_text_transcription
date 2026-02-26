import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Boolean, DateTime, ForeignKey,
    Text, Enum as SAEnum
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class MessageType(str, enum.Enum):
    text = "text"
    voice = "voice"
    image = "image"
    video = "video"
    document = "document"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    avatar_url = Column(String(512), nullable=True)
    is_online = Column(Boolean, default=False)
    about = Column(String(255), default="Hey there! I am using VoiceChat.")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_seen = Column(DateTime(timezone=True), nullable=True)

    sent_messages = relationship("Message", back_populates="sender", foreign_keys="Message.sender_id")
    room_memberships = relationship("RoomMember", back_populates="user")


class Room(Base):
    __tablename__ = "rooms"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=True)
    is_group = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    members = relationship("RoomMember", back_populates="room")
    messages = relationship("Message", back_populates="room", order_by="Message.created_at")


class RoomMember(Base):
    __tablename__ = "room_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id = Column(UUID(as_uuid=True), ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    joined_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    is_admin = Column(Boolean, default=False)

    room = relationship("Room", back_populates="members")
    user = relationship("User", back_populates="room_memberships")


class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id = Column(UUID(as_uuid=True), ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=True)          # text content or None for voice
    message_type = Column(SAEnum(MessageType), default=MessageType.text)
    file_path = Column(String(512), nullable=True)  # voice/image file path
    file_url = Column(String(512), nullable=True)   # public URL
    transcription = Column(Text, nullable=True)     # whisper output
    is_transcribed = Column(Boolean, default=False)
    faiss_index_id = Column(String(64), nullable=True)  # FAISS mapping key
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    is_deleted = Column(Boolean, default=False)
    deleted_for = Column(Text, nullable=True)  # comma-separated user IDs of those who deleted for themselves

    sender = relationship("User", back_populates="sent_messages", foreign_keys=[sender_id])
    room = relationship("Room", back_populates="messages")
