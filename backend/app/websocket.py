import json
from typing import Dict, Set, Optional
from fastapi import WebSocket
from sqlalchemy import update
from app.database import AsyncSessionLocal
from app import models

# room_id -> set of WebSocket connections
_connections: Dict[str, Set[WebSocket]] = {}


async def connect(room_id: str, websocket: WebSocket, user_id: Optional[str] = None):
    await websocket.accept()
    if room_id not in _connections:
        _connections[room_id] = set()
    _connections[room_id].add(websocket)
    
    if user_id:
        async with AsyncSessionLocal() as db:
            await db.execute(
                update(models.User).where(models.User.id == user_id).values(is_online=True)
            )
            await db.commit()
    print(f"[WS] Client {user_id} connected to room {room_id}. Total: {len(_connections[room_id])}")


async def disconnect(room_id: str, websocket: WebSocket, user_id: Optional[str] = None):
    if room_id in _connections:
        _connections[room_id].discard(websocket)
        if not _connections[room_id]:
            del _connections[room_id]
            
    if user_id:
        async with AsyncSessionLocal() as db:
            await db.execute(
                update(models.User).where(models.User.id == user_id).values(is_online=False)
            )
            await db.commit()
    print(f"[WS] Client {user_id} disconnected from room {room_id}")


async def broadcast_message(room_id: str, data: dict):
    """Send a message to all connected clients in a room."""
    if room_id not in _connections:
        return
    dead = set()
    payload = json.dumps(data, default=str)
    for ws in list(_connections[room_id]):
        try:
            await ws.send_text(payload)
        except Exception:
            dead.add(ws)
    for ws in dead:
        _connections[room_id].discard(ws)
