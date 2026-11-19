from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class SearchRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=1000, description="Search query")
    top_k: int = Field(default=5, ge=1, le=20, description="Number of results")
    tenant_id: str = Field(
        default="00000000-0000-0000-0000-000000000001",
        description="Tenant organization UUID"
    )

class Citation(BaseModel):
    chunk_id: str
    document_title: str
    section_header: str
    score: float
    excerpt: str

class ChatStreamRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000, description="User question")
    tenant_id: str = Field(
        default="00000000-0000-0000-0000-000000000001",
        description="Tenant organization UUID"
    )
    top_k: int = Field(default=4, ge=1, le=10)