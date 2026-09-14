"""Local, revisioned documentation retrieval for the ChatGPT MCP plugin."""
from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any
from urllib.parse import quote

_TOKEN = re.compile(r"[a-z0-9_]+")


class KnowledgeBase:
    def __init__(self, documents: Mapping[str, str], canonical_base_url: str) -> None:
        self.documents = dict(documents)
        self.canonical_base_url = canonical_base_url.rstrip("/")

    def search(self, query: str, limit: int = 8) -> dict[str, list[dict[str, str]]]:
        terms = set(_TOKEN.findall(query.lower()))
        matches: list[tuple[int, str]] = []
        for document_id, text in self.documents.items():
            score = sum(text.lower().count(term) for term in terms)
            if score:
                matches.append((score, document_id))
        matches.sort(key=lambda item: (-item[0], item[1]))
        return {"results": [self._result(document_id) for _, document_id in matches[:limit]]}

    def fetch(self, document_id: str) -> dict[str, Any]:
        if document_id not in self.documents:
            raise ValueError("Unknown knowledge document")
        result = self._result(document_id)
        return {**result, "text": self.documents[document_id], "metadata": {"source": "data-reporting-kit"}}

    def _result(self, document_id: str) -> dict[str, str]:
        return {
            "id": document_id,
            "title": document_id.rsplit("/", 1)[-1],
            "url": f"{self.canonical_base_url}/{quote(document_id)}",
        }
