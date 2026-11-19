import os
from dotenv import load_dotenv
from langchain_core.embeddings import Embeddings
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_ollama import OllamaEmbeddings, ChatOllama
from langchain_openai import OpenAIEmbeddings, ChatOpenAI

load_dotenv()

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")

LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:11434/v1")
LLM_API_KEY = os.getenv("LLM_API_KEY", os.getenv("OPENAI_API_KEY", "ollama"))
CHAT_MODEL = os.getenv("CHAT_MODEL", "llama3.2")


def get_embeddings_model() -> Embeddings:
    """Return LangChain Embeddings instance."""
    clean_url = OLLAMA_BASE_URL.replace("/v1", "").rstrip("/")
    if "11434" in clean_url or "ollama" in clean_url.lower():
        return OllamaEmbeddings(
            base_url=clean_url,
            model=EMBEDDING_MODEL
        )
    return OpenAIEmbeddings(
        base_url=OLLAMA_BASE_URL,
        api_key=LLM_API_KEY,
        model=EMBEDDING_MODEL
    )


def get_chat_model(temperature: float = 0.2) -> BaseChatModel:
    """Return LangChain ChatModel instance (Ollama or Cloud API)."""
    if "api." in LLM_BASE_URL or (LLM_API_KEY and LLM_API_KEY != "ollama"):
        return ChatOpenAI(
            base_url=LLM_BASE_URL,
            api_key=LLM_API_KEY,
            model=CHAT_MODEL,
            temperature=temperature
        )
    clean_url = LLM_BASE_URL.replace("/v1", "").rstrip("/")
    return ChatOllama(
        base_url=clean_url,
        model=CHAT_MODEL,
        temperature=temperature
    )
