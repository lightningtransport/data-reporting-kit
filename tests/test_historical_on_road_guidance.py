"""Owner-approved historical settlement activity routing, not live business counts."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
SURFACES = (
    "README.md", "AGENTS.md", "docs/agent-rules.md", "docs/question-routing.md",
    "docs/metric-definitions.md", "docs/data-dictionary.md",
    "docs/curated-response-policy.md", "docs/on-road-trucks.md",
    "skills/itpros-supabase-reporting/references/on-road-trucks.md",
    "docs/html-reporting.md", "skills/itpros-supabase-reporting/SKILL.md",
    "skills/agent-reporting-html/SKILL.md", "skills/reporting-html-shadcn/SKILL.md",
    "chatgpt-plugin/README.md", "chatgpt-plugin/skills/lightning-reporting/SKILL.md",
)


class HistoricalOnRoadGuidanceTests(unittest.TestCase):
    def test_historical_rule_reaches_every_instruction_surface(self):
        for path in SURFACES:
            with self.subTest(path=path):
                text = (ROOT / path).read_text()
                for required in (
                    "Historical on-road", "2026-10-12", "settlements", "Gross > 0",
                    "Gross = 0", "null Gross", "negative Gross", "distinct",
                    "1/2/3", "Tuesday", "Monday", "period_from", "period_to",
                    "From", "Owner", "Dispatch", "Owner OR shared_owner",
                    "containing settlement week", "explicitly requested assignment overlap",
                    "weekly counts are not additive", "GPS", "Paginate",
                ):
                    self.assertTrue(required in text, f"{path}: missing {required}")
                self.assertNotIn("An explicit calendar date asks for this dated metric", text)

    def test_source_contract_mirror_and_assignment_predicate_are_preserved(self):
        canonical = (ROOT / "docs/on-road-trucks.md").read_text()
        self.assertEqual(canonical, (ROOT / SURFACES[8]).read_text())
        for required in ("Out Date <= D", "Return Date > D", "excluding null returns",
                         "return day", "30-second", "2 MiB", "On The Road Working"):
            self.assertIn(required, canonical)

    def test_routing_and_metrics_name_settlement_week_activity(self):
        for path in ("docs/question-routing.md", "docs/metric-definitions.md"):
            with self.subTest(path=path):
                text = (ROOT / path).read_text()
                self.assertRegex(text, r"\| Historical on-road settlement-week activity \|[^\n]*settlements")
                self.assertIn("Explicitly requested assignment overlap", text)

    def test_packaged_versions_and_changelog(self):
        versions = {
            "skills/itpros-supabase-reporting/SKILL.md": "0.11.11",
            "skills/agent-reporting-html/SKILL.md": "0.2.7",
            "skills/reporting-html-shadcn/SKILL.md": "0.3.7",
        }
        for path, version in versions.items():
            with self.subTest(path=path):
                self.assertRegex((ROOT / path).read_text(), rf"(?m)^version: {re.escape(version)}$")
        changelog = (ROOT / "CHANGELOG.md").read_text()
        self.assertIn("Client skill 0.11.11", changelog)
        self.assertIn("historical on-road", changelog.lower())


if __name__ == "__main__":
    unittest.main()
