import os
import json
import threading
import numpy as np
from typing import List, Dict
from app.config import get_settings

settings = get_settings()

# ─── Message-level index (existing) ──────────────────────────────────────────
_index = None
_id_map: List[str] = []   # position → message_id

# ─── Sentence-level index (new) ──────────────────────────────────────────────
_sent_index = None
_sent_map: List[Dict] = []   # position → {message_id, sentence}

_model = None
_lock = threading.Lock()
EMBEDDING_DIM = 384  # all-MiniLM-L6-v2 output dim


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        print(f"[FAISS] Loading embedding model: {settings.embedding_model}")
        _model = SentenceTransformer(settings.embedding_model)
        print("[FAISS] Embedding model loaded")
    return _model


# ─── Persistence helpers ──────────────────────────────────────────────────────

def _load_index():
    global _index, _id_map, _sent_index, _sent_map
    import faiss

    # Message-level index
    if os.path.exists(settings.faiss_index_path) and os.path.exists(settings.faiss_id_map_path):
        print("[FAISS] Loading existing index from disk")
        _index = faiss.read_index(settings.faiss_index_path)
        with open(settings.faiss_id_map_path, "r") as f:
            _id_map = json.load(f)
        print(f"[FAISS] Loaded index with {_index.ntotal} vectors")
    else:
        print("[FAISS] Creating new flat L2 index")
        _index = faiss.IndexFlatL2(EMBEDDING_DIM)
        _id_map = []

    # Sentence-level index
    if os.path.exists(settings.faiss_sentence_index_path) and os.path.exists(settings.faiss_sentence_map_path):
        print("[FAISS] Loading existing sentence index from disk")
        _sent_index = faiss.read_index(settings.faiss_sentence_index_path)
        with open(settings.faiss_sentence_map_path, "r") as f:
            _sent_map = json.load(f)
        print(f"[FAISS] Loaded sentence index with {_sent_index.ntotal} vectors")
    else:
        print("[FAISS] Creating new sentence index")
        _sent_index = faiss.IndexFlatL2(EMBEDDING_DIM)
        _sent_map = []


def _save_index():
    import faiss
    faiss.write_index(_index, settings.faiss_index_path)
    with open(settings.faiss_id_map_path, "w") as f:
        json.dump(_id_map, f)


def _save_sent_index():
    import faiss
    faiss.write_index(_sent_index, settings.faiss_sentence_index_path)
    with open(settings.faiss_sentence_map_path, "w") as f:
        json.dump(_sent_map, f)


def initialize():
    """Call once on app startup."""
    _load_index()
    _get_model()  # warm up model


# ─── Message-level add / search (unchanged) ───────────────────────────────────

def add_embedding(message_id: str, text: str):
    """Encode text and add to message-level FAISS index."""
    if not text or not text.strip():
        return
    with _lock:
        try:
            model = _get_model()
            embedding = model.encode([text], normalize_embeddings=True)
            embedding = np.array(embedding, dtype=np.float32)
            _index.add(embedding)
            _id_map.append(message_id)
            _save_index()
        except Exception as e:
            print(f"[FAISS] Failed to add embedding for {message_id}: {e}")


def search(query: str, top_k: int = 20) -> List[str]:
    """Return message_ids most semantically similar to query."""
    if _index is None or _index.ntotal == 0:
        return []
    with _lock:
        try:
            model = _get_model()
            query_vec = model.encode([query], normalize_embeddings=True)
            query_vec = np.array(query_vec, dtype=np.float32)
            k = min(top_k, _index.ntotal)
            distances, indices = _index.search(query_vec, k)
            results = []
            for idx in indices[0]:
                if 0 <= idx < len(_id_map):
                    results.append(_id_map[idx])
            return results
        except Exception as e:
            print(f"[FAISS] Search failed: {e}")
            return []


# ─── Sentence-level add / search (new) ───────────────────────────────────────

def add_document_sentences(message_id: str, sentences: List[str]):
    """
    Encode each sentence and add to the sentence-level FAISS index.
    Each entry in _sent_map stores {message_id, sentence}.
    """
    if not sentences:
        return
    with _lock:
        try:
            model = _get_model()
            embeddings = model.encode(sentences, normalize_embeddings=True, show_progress_bar=False)
            embeddings = np.array(embeddings, dtype=np.float32)
            _sent_index.add(embeddings)
            for s in sentences:
                _sent_map.append({"message_id": message_id, "sentence": s})
            _save_sent_index()
            print(f"[FAISS] Indexed {len(sentences)} sentences for message {message_id}")
        except Exception as e:
            print(f"[FAISS] Failed to index sentences for {message_id}: {e}")


def search_sentences(query: str, top_k: int = 10) -> List[Dict]:
    """
    Return list of {message_id, sentence} dicts most semantically similar to query.
    Deduplicates: only the best-matching sentence per message is returned.
    """
    if _sent_index is None or _sent_index.ntotal == 0:
        return []
    with _lock:
        try:
            model = _get_model()
            query_vec = model.encode([query], normalize_embeddings=True)
            query_vec = np.array(query_vec, dtype=np.float32)
            k = min(top_k * 3, _sent_index.ntotal)   # fetch extra, deduplicate by message
            distances, indices = _sent_index.search(query_vec, k)
            seen_msgs = set()
            results = []
            for idx in indices[0]:
                if 0 <= idx < len(_sent_map):
                    entry = _sent_map[idx]
                    mid = entry["message_id"]
                    if mid not in seen_msgs:
                        seen_msgs.add(mid)
                        results.append(entry)
                        if len(results) >= top_k:
                            break
            return results
        except Exception as e:
            print(f"[FAISS] Sentence search failed: {e}")
            return []
