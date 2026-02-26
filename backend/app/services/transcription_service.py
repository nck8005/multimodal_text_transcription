import asyncio
import os
import shutil
from app.config import get_settings

settings = get_settings()

_whisper_model = None


def _inject_ffmpeg():
    """Try to add static-ffmpeg to PATH if system ffmpeg is absent."""
    if shutil.which("ffmpeg"):
        return True  # already available

    try:
        from static_ffmpeg import add_paths
        add_paths()
        print("[Whisper] static-ffmpeg paths injected")
        return True
    except ImportError:
        pass

    # Fallback: scan common install locations
    possible_paths = [
        os.path.expanduser("~/.static_ffmpeg/bin"),
        os.path.join(
            os.environ.get("APPDATA", ""),
            "Python", "Python313", "site-packages", "static_ffmpeg", "bin",
        ),
        r"C:\Users\navan\AppData\Local\Programs\Python\Python313\Lib\site-packages\static_ffmpeg\bin",
    ]
    for p in possible_paths:
        if os.path.exists(p) and p not in os.environ["PATH"]:
            os.environ["PATH"] = p + os.pathsep + os.environ["PATH"]
            print(f"[Whisper] Manually added path: {p}")

    if shutil.which("ffmpeg"):
        return True

    print("[Whisper] ERROR: ffmpeg NOT FOUND. Install static-ffmpeg: pip install static-ffmpeg")
    return False


def load_whisper_model():
    """Load faster-whisper model (int8, CPU). Called once at startup."""
    global _whisper_model
    if _whisper_model is not None:
        return _whisper_model

    if not _inject_ffmpeg():
        return None

    from faster_whisper import WhisperModel

    model_name = settings.whisper_model  # e.g. "base" or "small"
    print(f"[Whisper] Loading faster-whisper model: {model_name} (int8, cpu)")
    # compute_type="int8" is the key speed-up on CPU
    _whisper_model = WhisperModel(model_name, device="cpu", compute_type="int8")
    print("[Whisper] faster-whisper model loaded successfully")
    return _whisper_model


async def transcribe_audio(file_path: str) -> str:
    """
    Transcribe audio file using faster-whisper (runs locally, free).
    Returns the transcribed text.
    """
    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(None, _do_transcribe, file_path)
        return result
    except Exception as e:
        err = str(e)
        if "ffmpeg" in err.lower() or "[WinError 2]" in err:
            print("[Whisper] ERROR: ffmpeg is required but not found.")
            return "[Transcription failed: ffmpeg not found]"
        print(f"[Whisper] Transcription failed for {file_path}: {e}")
        return "[Transcription failed]"


def _do_transcribe(file_path: str) -> str:
    abs_path = os.path.abspath(file_path)
    model = load_whisper_model()
    if model is None:
        raise RuntimeError("Whisper model not loaded: ffmpeg missing")

    # faster-whisper returns a generator of Segment objects
    segments, _info = model.transcribe(
        abs_path,
        beam_size=5,          # quality / speed balance (default 5)
        language=None,        # auto-detect
        vad_filter=True,      # skip silent parts → much faster
        vad_parameters=dict(min_silence_duration_ms=500),
    )
    text = " ".join(seg.text.strip() for seg in segments).strip()
    return text if text else "[No speech detected]"
