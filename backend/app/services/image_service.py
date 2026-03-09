"""
image_service.py — Extract text from images using EasyOCR (free, local).
Supports JPEG, PNG, BMP, TIFF, WEBP, and most common formats.
"""
import os
from typing import List

_reader = None


def _get_reader():
    """Lazy-load EasyOCR reader (downloads model ~100 MB on first use)."""
    global _reader
    if _reader is None:
        import easyocr
        print("[ImageOCR] Loading EasyOCR reader (English)...")
        # gpu=False → pure CPU; language list can be extended
        _reader = easyocr.Reader(["en"], gpu=False, verbose=False)
        print("[ImageOCR] EasyOCR reader loaded")
    return _reader


def extract_text_from_image(file_path: str) -> str:
    """
    Run OCR on the given image file and return all detected text as a single string.
    Returns empty string if no text found or on failure.
    Uses OpenCV to downscale large images for much faster OCR processing.
    """
    if not os.path.exists(file_path):
        print(f"[ImageOCR] File not found: {file_path}")
        return ""
    try:
        import cv2
        image = cv2.imread(file_path)
        if image is None:
            return ""

        # Resize image for much faster OCR if it's too large
        max_dim = 1000
        h, w = image.shape[:2]
        if max(h, w) > max_dim:
            scale = max_dim / max(h, w)
            new_w, new_h = int(w * scale), int(h * scale)
            image = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)

        reader = _get_reader()
        # detail=0 → returns plain strings (not bounding boxes)
        results = reader.readtext(image, detail=0, paragraph=True)
        text = " ".join(r.strip() for r in results if r.strip())
        print(f"[ImageOCR] Extracted {len(text)} chars from {os.path.basename(file_path)}")
        return text
    except Exception as e:
        print(f"[ImageOCR] Failed to extract text from {file_path}: {e}")
        return ""


def chunk_text(text: str, chunk_size: int = 200, overlap: int = 50) -> List[str]:
    """
    Sliding-window character-level chunking.
    chunk_size: max characters per chunk.
    overlap: characters shared between adjacent chunks (context continuity).
    Returns list of non-empty chunks.
    """
    if not text or not text.strip():
        return []

    text = text.strip()
    if len(text) <= chunk_size:
        return [text]

    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(text):
            break
        start += chunk_size - overlap  # slide forward with overlap

    return chunks
