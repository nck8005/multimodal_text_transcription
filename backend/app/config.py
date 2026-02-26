from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/chatapp"
    secret_key: str = "your-super-secret-key"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080
    whisper_model: str = "tiny"
    upload_dir: str = "./uploads"
    faiss_index_path: str = "./faiss_index.bin"
    faiss_id_map_path: str = "./faiss_id_map.json"
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    faiss_sentence_index_path: str = "./faiss_sentences.bin"
    faiss_sentence_map_path: str = "./faiss_sentence_map.json"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings():
    return Settings()
