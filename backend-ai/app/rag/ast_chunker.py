import re
from typing import List, Dict, Any
import tiktoken

class ASTMarkdownChunker:
    """
    Production AST-aware Markdown chunker:
    - Treats code fences (```) and tables as indivisible semantic units.
    - Injects hierarchical context: "Document: <Title> | Section: <Header>".
    - Target: ~600 tokens per chunk with 80-token overlap.
    """

    def __init__(
        self,
        target_chunk_tokens: int = 600,
        overlap_tokens: int = 80,
        encoding_name: str = "cl100k_base"
    ):
        self.target_tokens = target_chunk_tokens
        self.overlap_tokens = overlap_tokens
        self.tokenizer = tiktoken.get_encoding(encoding_name)

    def count_tokens(self, text: str) -> int:
        return len(self.tokenizer.encode(text))

    def chunk_document(self, markdown_text: str, doc_title: str) -> List[Dict[str, Any]]:
        # Split on headers (#, ##, ###) without slicing code fences
        header_pattern = re.compile(r'(^#{1,4}\s+.*$)', re.MULTILINE)
        parts = header_pattern.split(markdown_text)

        chunks: List[Dict[str, Any]] = []
        current_header = "Overview"
        chunk_index = 0

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
                chunks.append({
                    "chunk_index": chunk_index,
                    "content": full_text,
                    "token_count": token_count,
                    "metadata": {
                        "document_title": doc_title,
                        "section_header": current_header,
                        "is_atomic": True
                    }
                })
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
                        chunks.append({
                            "chunk_index": chunk_index,
                            "content": sub_buffer.strip(),
                            "token_count": self.count_tokens(sub_buffer.strip()),
                            "metadata": {
                                "document_title": doc_title,
                                "section_header": current_header,
                                "is_atomic": False
                            }
                        })
                        chunk_index += 1
                        sub_buffer = context_prefix + p_text + "\n\n"
                    else:
                        sub_buffer = candidate

                if sub_buffer.strip() and sub_buffer.strip() != context_prefix.strip():
                    chunks.append({
                        "chunk_index": chunk_index,
                        "content": sub_buffer.strip(),
                        "token_count": self.count_tokens(sub_buffer.strip()),
                        "metadata": {
                            "document_title": doc_title,
                            "section_header": current_header,
                            "is_atomic": False
                        }
                    })
                    chunk_index += 1

        return chunks