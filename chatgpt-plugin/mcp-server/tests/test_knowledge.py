from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

import tempfile

from knowledge import KnowledgeBase, load_documents


class KnowledgeBaseTests(unittest.TestCase):
    def test_search_returns_citable_documents_ranked_by_matching_terms(self):
        base = KnowledgeBase(
            {
                "AGENTS.md": "Read the reporting catalog before requesting settlement data.",
                "docs/agent-rules.md": "Settlement periods always run Tuesday through Monday.",
            },
            "https://github.com/lightningtransport/data-reporting-kit/blob/main",
        )

        result = base.search("settlement period")

        self.assertEqual(result["results"][0]["id"], "docs/agent-rules.md")
        self.assertEqual(result["results"][0]["url"], "https://github.com/lightningtransport/data-reporting-kit/blob/main/docs/agent-rules.md")

    def test_fetch_returns_only_a_known_document(self):
        base = KnowledgeBase({"AGENTS.md": "Approved reporting instructions."}, "https://example.test/repo")

        self.assertEqual(base.fetch("AGENTS.md")["text"], "Approved reporting instructions.")
        with self.assertRaisesRegex(ValueError, "Unknown knowledge document"):
            base.fetch(".env")

    def test_load_documents_prefers_local_checkout_and_falls_back_to_repository(self):
        requested: list[str] = []

        def read_url(url: str) -> str:
            requested.append(url)
            return "remote rules"

        with tempfile.TemporaryDirectory() as directory:
            Path(directory, "AGENTS.md").write_text("local rules", encoding="utf-8")
            documents = load_documents(
                ["AGENTS.md", "docs/agent-rules.md"],
                Path(directory),
                "https://raw.example.test/repo/main/",
                read_url,
            )

        self.assertEqual(documents, {"AGENTS.md": "local rules", "docs/agent-rules.md": "remote rules"})
        self.assertEqual(requested, ["https://raw.example.test/repo/main/docs/agent-rules.md"])
