from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

from knowledge import KnowledgeBase


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
