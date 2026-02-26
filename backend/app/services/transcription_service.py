import asyncio
import os
from functools import lru_cache
from app.config import get_settings

settings = get_settings()

_whisper_model = None


import shutil

def load_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        # Try to inject static-ffmpeg paths if available
        try:
            from static_ffmpeg import add_paths
            add_paths()
            print("[Whisper] static-ffmpeg paths injected")
        except ImportError:
            # Plan B: Try to find common static-ffmpeg locations manually if the module is missing
            possible_paths = [
                os.path.expanduser("~/.static_ffmpeg/bin"),
                os.path.join(os.environ.get("APPDATA", ""), "Python", "Python313", "site-packages", "static_ffmpeg", "bin"),
                "C:\\Users\\navan\\AppData\\Local\\Programs\\Python\\Python313\\Lib\\site-packages\\static_ffmpeg\\bin"
            ]
            for p in possible_paths:
                if os.path.exists(p) and p not in os.environ["PATH"]:
                    os.environ["PATH"] = p + os.pathsep + os.environ["PATH"]
                    print(f"[Whisper] Manually added path: {p}")
            pass

        if not shutil.which("ffmpeg"):
            print("[Whisper] ERROR: ffmpeg NOT FOUND in system path.")
            print("[Whisper] Please install ffmpeg in this environment: 'pip install static-ffmpeg' then restart.")
            return None
        import whisper
        print(f"[Whisper] Loading model: {settings.whisper_model}")
        _whisper_model = whisper.load_model(settings.whisper_model)
        print("[Whisper] Model loaded successfully")
    return _whisper_model


async def transcribe_audio(file_path: str) -> str:
    """
    Transcribe audio file using OpenAI Whisper (runs locally, free).
    Returns the transcribed text.
    """
    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(None, _do_transcribe, file_path)
        return result
    except Exception as e:
        if "ffmpeg" in str(e).lower() or "[WinError 2]" in str(e):
            print(f"[Whisper] ERROR: ffmpeg is required but not found. Please install it.")
            return "[Transcription failed: ffmpeg not found]"
        print(f"[Whisper] Transcription failed for {file_path}: {e}")
        return "[Transcription failed]"


def _do_transcribe(file_path: str) -> str:
    # Normalize path for local OS
    abs_path = os.path.abspath(file_path)
    model = load_whisper_model()
    if model is None:
        raise RuntimeError("Whisper model not loaded: ffmpeg missing")
    result = model.transcribe(
        abs_path,
        fp16=False,          # CPU-safe
        language=None,       # auto-detect language
        verbose=False,
    )
    text = result.get("text", "").strip()
    return text if text else "[No speech detected]"
