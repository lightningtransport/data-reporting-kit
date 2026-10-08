"""Regression for the rejected docs/diesel.md knowledge request.

The affected third-party wrapper is not in this repository. Verify the canonical
instructions it can already read, plus actual packaged knowledge retrieval.
"""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "chatgpt-plugin/mcp-server/src"))
from knowledge import KnowledgeBase


class FuelKnowledgeRoutingTests(unittest.TestCase):
    def test_spanish_company_fuel_question_retrieves_existing_approved_guidance(self):
        paths = ["docs/question-routing.md", "docs/data-dictionary.md",
                 "docs/metric-definitions.md"]
        base = KnowledgeBase({p: (ROOT / p).read_text() for p in paths},
                             "https://github.com/lightningtransport/data-reporting-kit/blob/main")
        results = base.search("reporte de petroleo dividido por companias")
        routing = next(r for r in results["results"] if r["id"] == paths[0])
        text = " ".join(base.fetch(routing["id"])["text"].split())
        self.assertIn("reporte de petroleo dividido por companias", text)
        for path in paths:
            self.assertIn(f"`{path}`", text)
        self.assertIn("not a knowledge-document path", text)
        self.assertIn("preserving `offset` and `limit`", text)
        self.assertIn("no `company` field or filter", text)
        self.assertIn("ask for the date period", text)
        self.assertIn("Do not add overlapping owner-filtered totals", text)

    def test_entrypoint_and_packaged_skills_prevent_invented_document_paths(self):
        for path in ["AGENTS.md", "docs/agent-rules.md",
                     "skills/itpros-supabase-reporting/SKILL.md",
                     "chatgpt-plugin/skills/lightning-reporting/SKILL.md"]:
            with self.subTest(path=path):
                text = (ROOT / path).read_text()
                self.assertIn("Never invent a document path", text)
                self.assertIn("docs/question-routing.md", text)
                self.assertIn("preserving `offset` and `limit`", text)
                self.assertIn("skills/", text)

    def test_unknown_documents_stay_rejected(self):
        base = KnowledgeBase({"docs/question-routing.md": "fuel"}, "https://example.test")
        for path in ["docs/diesel.md", "../../.env", ".env"]:
            with self.subTest(path=path), self.assertRaisesRegex(ValueError, "Unknown knowledge document"):
                base.fetch(path)


if __name__ == "__main__":
    unittest.main()
