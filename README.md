# VoiceChat — Setup & Run Guide

## Prerequisites
- Python 3.10+
- Node.js 18+
- Docker Desktop (for PostgreSQL) **OR** local PostgreSQL 14+
- ffmpeg (required by Whisper for audio processing)

### Install ffmpeg on Windows
Download from https://ffmpeg.org/download.html and add to PATH, OR via winget:
```
winget install ffmpeg
```

---

## 1. Start PostgreSQL

**Option A: With Docker (if installed)**
```bash
docker compose up -d postgres
```

**Option B: Manual Install (if you don't have Docker)**
1. Download and install PostgreSQL from [postgresql.org](https://www.postgresql.org/download/windows/).
2. During installation, set the password to `password` (or remember what you set).
3. Open **pgAdmin** or **psql** and create a new database named `chatapp`.
4. If you used a different password or user, update the `DATABASE_URL` in `backend/.env`.

---

## 2. Setup Backend

```bash
cd backend

# Copy environment file
copy .env.example .env

# (Optional) edit .env to set your DATABASE_URL if not using defaults

# Create virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Start backend
uvicorn app.main:app --reload --port 8000
```

- API docs: http://localhost:8000/docs
- First startup will download Whisper (~140MB) and the embedding model (~90MB) automatically.

---

## 3. Setup Frontend

```bash
cd frontend
npm install
npm run dev
```

- App runs at: **http://localhost:5173**

---

## 4. Usage

1. Open http://localhost:5173
2. Register two accounts (open in two browser tabs)
3. Login with each account
4. Click **+** to start a direct message chat
5. Send text messages — they appear in real-time via WebSocket
6. **Hold the 🎙 mic button** to record a voice message → release to send
7. Whisper automatically transcribes voice messages in the background
8. **Search** (top of sidebar): type any word to find it in both text
   messages and voice transcriptions simultaneously

---

## 5. How Search Works

| Match Type | Source | Example |
|---|---|---|
| 💬 Text | Message content | `ILIKE '%query%'` |
| 🎙 Voice | Whisper transcription | `ILIKE '%query%'` on transcription |
| ✨ Semantic | FAISS + MiniLM-L6-v2 | Near-meaning results |

All models run **locally and free** — no API keys needed.
