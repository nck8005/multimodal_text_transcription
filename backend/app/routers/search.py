from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload
from typing import Optional
import uuid
from app.database import get_db
from app import models, schemas
from app.auth import get_current_user
from app.services import search_index

router = APIRouter(prefix="/api", tags=["search"])


@router.get("/search", response_model=schemas.SearchResponse)
async def search_messages(
    q: str = Query(..., min_length=1),
    room_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not q.strip():
        return schemas.SearchResponse(query=q, results=[], total=0)

    # Get rooms user is a member of
    rooms_result = await db.execute(
        select(models.RoomMember.room_id).where(
            models.RoomMember.user_id == current_user.id
        )
    )
    user_room_ids = [r[0] for r in rooms_result.fetchall()]

    if not user_room_ids:
        return schemas.SearchResponse(query=q, results=[], total=0)

    base_conditions = [
        models.Message.room_id.in_(user_room_ids),
        models.Message.is_deleted == False,
    ]
    if room_id:
        base_conditions.append(models.Message.room_id == room_id)

    # ── 1. Keyword search (text content + transcription) ─────────────────────
    keyword_filter = or_(
        models.Message.content.ilike(f"%{q}%"),
        models.Message.transcription.ilike(f"%{q}%"),
    )
    keyword_result = await db.execute(
        select(models.Message)
        .options(selectinload(models.Message.sender))
        .where(and_(*base_conditions, keyword_filter))
        .order_by(models.Message.created_at.desc())
        .limit(30)
    )
    keyword_messages = keyword_result.scalars().all()

    # ── 2. Semantic search via FAISS (message-level) ──────────────────────────
    semantic_ids = search_index.search(q, top_k=20)
    semantic_messages = []
    if semantic_ids:
        sem_result = await db.execute(
            select(models.Message)
            .options(selectinload(models.Message.sender))
            .where(and_(
                *base_conditions,
                models.Message.id.in_([uuid.UUID(mid) for mid in semantic_ids if _is_valid_uuid(mid)]),
            ))
        )
        semantic_messages = sem_result.scalars().all()

    # ── 3. Sentence-level search via FAISS (documents) ────────────────────────
    sentence_hits = search_index.search_sentences(q, top_k=10)
    sentence_message_ids = list({h["message_id"] for h in sentence_hits if _is_valid_uuid(h["message_id"])})
    sentence_snippet_map = {}  # message_id → best sentence
    for h in sentence_hits:
        mid = h["message_id"]
        if mid not in sentence_snippet_map:
            sentence_snippet_map[mid] = h["sentence"]

    sentence_messages = []
    if sentence_message_ids:
        sent_result = await db.execute(
            select(models.Message)
            .options(selectinload(models.Message.sender))
            .where(and_(
                *base_conditions,
                models.Message.id.in_([uuid.UUID(mid) for mid in sentence_message_ids]),
            ))
        )
        sentence_messages = sent_result.scalars().all()

    # ── 4. Merge results ──────────────────────────────────────────────────────
    seen_ids = set()
    results = []

    # Keyword hits first
    for msg in keyword_messages:
        if str(msg.id) in seen_ids:
            continue
        seen_ids.add(str(msg.id))
        match_type = "text"
        searchable = msg.content or ""
        if msg.transcription and q.lower() in (msg.transcription or "").lower():
            if msg.message_type == "document":
                match_type = "document"
                searchable = msg.transcription
            else:
                match_type = "transcription"
                searchable = msg.transcription
        snippet = _extract_snippet(searchable, q)
        results.append(schemas.SearchResult(
            message=schemas.MessageOut.model_validate(msg),
            snippet=snippet,
            match_type=match_type,
            score=1.0,
        ))

    # Semantic message-level hits
    for msg in semantic_messages:
        if str(msg.id) in seen_ids:
            continue
        seen_ids.add(str(msg.id))
        searchable = msg.transcription or msg.content or ""
        snippet = _extract_snippet(searchable, q)
        results.append(schemas.SearchResult(
            message=schemas.MessageOut.model_validate(msg),
            snippet=snippet,
            match_type="semantic",
            score=0.8,
        ))

    # Sentence-level document hits
    for msg in sentence_messages:
        if str(msg.id) in seen_ids:
            continue
        seen_ids.add(str(msg.id))
        best_sentence = sentence_snippet_map.get(str(msg.id), "")
        snippet = _extract_snippet(best_sentence, q) if best_sentence else ""
        results.append(schemas.SearchResult(
            message=schemas.MessageOut.model_validate(msg),
            snippet=snippet,
            match_type="document",
            score=0.75,
        ))

    return schemas.SearchResponse(query=q, results=results, total=len(results))


def _extract_snippet(text: str, query: str, window: int = 80) -> str:
    if not text:
        return ""
    lower_text = text.lower()
    lower_query = query.lower()
    idx = lower_text.find(lower_query)
    if idx == -1:
        return text[:window * 2]
    start = max(0, idx - window // 2)
    end = min(len(text), idx + len(query) + window // 2)
    snippet = ("..." if start > 0 else "") + text[start:end] + ("..." if end < len(text) else "")
    return snippet


def _is_valid_uuid(val: str) -> bool:
    try:
        uuid.UUID(val)
        return True
    except (ValueError, AttributeError):
        return False
