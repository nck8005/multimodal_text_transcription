import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.database import create_tables
from app.config import get_settings
from app.services import search_index
from app.services.transcription_service import load_whisper_model
from app import websocket as ws_manager
from app.auth import get_current_user_ws
from app.database import AsyncSessionLocal
from app.routers import users, rooms, messages, search

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ───────────────────────────────────────────────────────────
    print("[Startup] Creating database tables...")
    await create_tables()

    print("[Startup] Creating upload directories...")
    os.makedirs(os.path.join(settings.upload_dir, "voice"), exist_ok=True)
    os.makedirs(os.path.join(settings.upload_dir, "images"), exist_ok=True)

    print("[Startup] Initializing FAISS index and embedding model...")
    search_index.initialize()

    print("[Startup] Pre-loading Whisper model (this may take a moment)...")
    import threading
    threading.Thread(target=load_whisper_model, daemon=True).start()

    print("[Startup] All systems ready done")
    yield

    # ── Shutdown ──────────────────────────────────────────────────────────
    print("[Shutdown] Saving FAISS index...")
    search_index._save_index()


app = FastAPI(
    title="VoiceChat API",
    description="WhatsApp-like chat with voice transcription search",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static files (voice uploads) ──────────────────────────────────────────────
os.makedirs(settings.upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(users.router)
app.include_router(users.users_router)
app.include_router(rooms.router)
app.include_router(messages.router)
app.include_router(search.router)


# ── WebSocket ─────────────────────────────────────────────────────────────────
@app.websocket("/ws/{room_id}")
async def websocket_endpoint(
    room_id: str,
    websocket: WebSocket,
    token: str = Query(...),
):
    async with AsyncSessionLocal() as db:
        user = await get_current_user_ws(token, db)

    if not user:
        await websocket.close(code=4001)
        return

    await ws_manager.connect(room_id, websocket, user_id=str(user.id))
    try:
        while True:
            # Keep connection alive; messages are sent server→client only via broadcast
            data = await websocket.receive_text()
            # Client can send a ping to keep alive
    except WebSocketDisconnect:
        await ws_manager.disconnect(room_id, websocket, user_id=str(user.id))


@app.get("/health")
async def health():
    return {"status": "ok", "service": "VoiceChat API"}
