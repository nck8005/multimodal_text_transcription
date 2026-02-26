from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field
import uuid


# ─── Auth ────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)
    avatar_url: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: uuid.UUID
    username: str
    email: str
    avatar_url: Optional[str] = None
    about: Optional[str] = "Hey there! I am using VoiceChat."
    is_online: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    avatar_url: Optional[str] = None
    about: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ─── Room ────────────────────────────────────────────────────────────────────

class RoomCreate(BaseModel):
    name: Optional[str] = None
    is_group: bool = False
    member_ids: List[uuid.UUID]


class RoomOut(BaseModel):
    id: uuid.UUID
    name: Optional[str]
    is_group: bool
    created_at: datetime
    members: List[UserOut] = []
    last_message: Optional["MessageOut"] = None

    class Config:
        from_attributes = True


# ─── Message ─────────────────────────────────────────────────────────────────

class MessageCreate(BaseModel):
    content: str


class MessageOut(BaseModel):
    id: uuid.UUID
    room_id: uuid.UUID
    sender_id: uuid.UUID
    content: Optional[str]
    message_type: str
    file_url: Optional[str] = None
    transcription: Optional[str] = None
    is_transcribed: bool = False
    is_deleted: bool = False
    deleted_for: Optional[str] = None
    created_at: datetime
    sender: Optional[UserOut] = None

    class Config:
        from_attributes = True


RoomOut.model_rebuild()


# ─── Search ──────────────────────────────────────────────────────────────────

class SearchResult(BaseModel):
    message: MessageOut
    snippet: str
    match_type: str   # "text" | "transcription" | "semantic"
    score: float = 1.0


class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]
    total: int
