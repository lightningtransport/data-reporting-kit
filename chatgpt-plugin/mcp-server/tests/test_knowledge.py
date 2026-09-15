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

    def test_canonical_html_reporting_doc_is_available_to_packaged_knowledge(self):
        root = Path(__file__).parents[3]
        html_reporting = (root / "docs/html-reporting.md").read_text(encoding="utf-8")
        self.assertIn("three calendar months", html_reporting)
        self.assertIn("report-ui.css", html_reporting)

        base = KnowledgeBase({"docs/html-reporting.md": html_reporting}, "https://github.com/lightningtransport/data-reporting-kit/blob/main")
        result = base.search("html report three months css")
        self.assertEqual(result["results"][0]["id"], "docs/html-reporting.md")
