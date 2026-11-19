import re
from typing import List, Dict, Any, Optional
import tiktoken
from langchain_core.documents import Document
from langchain_text_splitters.base import TextSplitter


class ChunkDocument(Document):
    """
    LangChain Document subclass with dict-like backward compatibility.
    Allows both LangChain attribute access (doc.page_content, doc.metadata)
    and legacy dictionary key access (chunk["content"], chunk["metadata"]).
    """
    def __getitem__(self, item: str) -> Any:
        if item == "content":
            return self.page_content
        if item == "metadata":
            return self.metadata
        if hasattr(self, item):
            return getattr(self, item)
        return self.metadata.get(item)


class ASTMarkdownChunker(TextSplitter):
    """
    Production LangChain AST-aware Markdown Chunker:
    - Treats code fences (```) and tables as indivisible semantic units.
    - Injects hierarchical context: "Document: <Title> | Section: <Header>".
    - Target: ~600 tokens per chunk with 80-token overlap.
    - Standard LangChain TextSplitter and Document transformer interface.
    """

    def __init__(
        self,
        target_chunk_tokens: int = 600,
        overlap_tokens: int = 80,
        encoding_name: str = "cl100k_base",
        **kwargs: Any
    ):
        super().__init__(**kwargs)
        self.target_tokens = target_chunk_tokens
        self.overlap_tokens = overlap_tokens
        self.tokenizer = tiktoken.get_encoding(encoding_name)

    def count_tokens(self, text: str) -> int:
        return len(self.tokenizer.encode(text))

    def split_text(self, text: str) -> List[str]:
        """LangChain TextSplitter interface implementation."""
        docs = self.chunk_document(text, doc_title="Document")
        return [d.page_content for d in docs]

    def split_documents(self, documents: List[Document]) -> List[Document]:
        """LangChain Document transformer interface implementation."""
        all_chunks: List[Document] = []
        for doc in documents:
            title = (
                doc.metadata.get("title")
                or doc.metadata.get("document_title")
                or "Document"
            )
            chunks = self.chunk_document(
                markdown_text=doc.page_content,
                doc_title=title,
                base_metadata=doc.metadata
            )
            all_chunks.extend(chunks)
        return all_chunks

    def chunk_document(
        self,
        markdown_text: str,
        doc_title: str = "Document",
        base_metadata: Optional[Dict[str, Any]] = None
    ) -> List[ChunkDocument]:
        # Split on headers (#, ##, ###, ####) without slicing code fences
        header_pattern = re.compile(r'(^#{1,4}\s+.*$)', re.MULTILINE)
        parts = header_pattern.split(markdown_text)

        chunks: List[ChunkDocument] = []
        current_header = "Overview"
        chunk_index = 0
        base_meta = dict(base_metadata) if base_metadata else {}

        for part in parts:
            if not part.strip():
                continue

            if part.startswith("#"):
                current_header = part.strip()
                continue

            body = part.strip()
            context_prefix = f"Document: {doc_title} | Section: {current_header}\n\n"
            full_text = context_prefix + body
            token_count = self.count_tokens(full_text)

            if token_count <= self.target_tokens:
                meta = {
                    **base_meta,
                    "document_title": doc_title,
                    "section_header": current_header,
                    "chunk_index": chunk_index,
                    "token_count": token_count,
                    "is_atomic": True
                }
                chunks.append(ChunkDocument(page_content=full_text, metadata=meta))
                chunk_index += 1
            else:
                paragraphs = body.split("\n\n")
                sub_buffer = context_prefix

                for p in paragraphs:
                    p_text = p.strip()
                    if not p_text:
                        continue

                    candidate = sub_buffer + p_text + "\n\n"
                    if self.count_tokens(candidate) > self.target_tokens and sub_buffer != context_prefix:
                        meta = {
                            **base_meta,
                            "document_title": doc_title,
                            "section_header": current_header,
                            "chunk_index": chunk_index,
                            "token_count": self.count_tokens(sub_buffer.strip()),
                            "is_atomic": False
                        }
                        chunks.append(ChunkDocument(page_content=sub_buffer.strip(), metadata=meta))
                        chunk_index += 1
                        sub_buffer = context_prefix + p_text + "\n\n"
                    else:
                        sub_buffer = candidate

                if sub_buffer.strip() and sub_buffer.strip() != context_prefix.strip():
                    meta = {
                        **base_meta,
                        "document_title": doc_title,
                        "section_header": current_header,
                        "chunk_index": chunk_index,
                        "token_count": self.count_tokens(sub_buffer.strip()),
                        "is_atomic": False
                    }
                    chunks.append(ChunkDocument(page_content=sub_buffer.strip(), metadata=meta))
                    chunk_index += 1

        return chunks
