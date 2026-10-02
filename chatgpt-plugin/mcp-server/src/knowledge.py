"""Local, revisioned documentation retrieval for the ChatGPT MCP plugin."""
from __future__ import annotations

import re
from collections.abc import Callable, Iterable, Mapping
from pathlib import Path
from typing import Any
from urllib.parse import quote
from urllib.request import urlopen

_TOKEN = re.compile(r"[a-z0-9_]+")


def _read_url(url: str) -> str:
    with urlopen(url, timeout=10) as response:
        return response.read().decode("utf-8")


def load_documents(
    paths: Iterable[str],
    root: Path | None,
    raw_base_url: str,
    read_url: Callable[[str], str] = _read_url,
) -> dict[str, str]:
    """Read each document from a local checkout, or from the repository when not bundled."""
    documents: dict[str, str] = {}
    for path in paths:
        local = root / path if root else None
        if local and local.is_file():
            documents[path] = local.read_text(encoding="utf-8")
        else:
            documents[path] = read_url(f"{raw_base_url.rstrip('/')}/{quote(path)}")
    return documents


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
