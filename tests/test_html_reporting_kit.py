from __future__ import annotations

import json
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


class HtmlReportingKitTests(unittest.TestCase):
    def test_shared_stylesheet_exposes_required_component_classes(self):
        css = (ROOT / "skills/reporting-html-shadcn/assets/report-ui.css").read_text(encoding="utf-8")
        for token in (
            ".page-shell",
            ".report-header",
            ".toolbar",
            ".kpi-strip",
            ".card",
            "table.data",
            ".tag-np",
            ".evidence",
            "--background:",
        ):
            self.assertIn(token, css)

    def test_agents_and_skills_require_three_month_html_history_window(self):
        agents = (ROOT / "AGENTS.md").read_text(encoding="utf-8")
        html_skill = (ROOT / "skills/agent-reporting-html/SKILL.md").read_text(encoding="utf-8")
        self.assertIn("docs/html-reporting.md", agents)
        self.assertIn("skills/agent-reporting-html", agents)
        self.assertIn("skills/reporting-html-shadcn", agents)
        self.assertIn("apps/reporting-dashboard", agents)
        self.assertRegex(agents, r"three calendar months|at least three calendar months")
        self.assertRegex(html_skill, r"3 months|three calendar months")
        self.assertRegex(agents, r"Grok Bot|Cursor")
        self.assertNotIn("ChatGPT", html_skill)

    def test_readme_start_here_points_at_html_skills(self):
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn("docs/html-reporting.md", readme)
        self.assertIn("apps/reporting-dashboard", readme)
        self.assertIn("Grok Bot", readme)

    def test_dashboard_uses_shadcn_owner_multiselect_not_native_select(self):
        src = ROOT / "apps/reporting-dashboard/src"
        texts = "\n".join(path.read_text(encoding="utf-8") for path in src.rglob("*.tsx"))
        owner = (ROOT / "apps/reporting-dashboard/src/components/owner-multi-select.tsx").read_text(
            encoding="utf-8"
        )
        self.assertIn("OwnerMultiSelect", texts)
        self.assertIn("Popover", owner)
        self.assertIn("Command", owner)
        self.assertNotRegex(texts, r"<select[^>]*multiple")
        self.assertTrue((ROOT / "apps/reporting-dashboard/src/data/settlement-summary.json").is_file())
        self.assertTrue((ROOT / "apps/reporting-dashboard/vercel.json").is_file())
        html = (ROOT / "docs/html-reporting.md").read_text(encoding="utf-8")
        self.assertIn("PENDING_VERCEL_PRODUCTION_URL", html)
        self.assertRegex(html, r"link (that |the )?live URL", re.I)

    def test_embedded_settlement_window_covers_three_months(self):
        payload = json.loads(
            (ROOT / "apps/reporting-dashboard/src/data/settlement-summary.json").read_text(
                encoding="utf-8"
            )
        )
        weeks = sorted({row["pf"] for row in payload["rows"]})
        self.assertGreaterEqual(len(weeks), 12)
        self.assertLessEqual(weeks[0], "2026-06-02")
        self.assertGreaterEqual(weeks[-1], "2026-09-01")
        self.assertTrue(payload["meta"]["pagination_complete"])

    def test_new_guidance_files_do_not_embed_secrets(self):
        paths = [
            ROOT / "docs/html-reporting.md",
            ROOT / "skills/agent-reporting-html/SKILL.md",
            ROOT / "skills/reporting-html-shadcn/SKILL.md",
            ROOT / "skills/reporting-html-shadcn/assets/report-ui.css",
            ROOT / "apps/reporting-dashboard/.env.example",
            ROOT / "apps/reporting-dashboard/README.md",
        ]
        secret_pattern = re.compile(
            r"(sk-[A-Za-z0-9]{16,}|eyJ[A-Za-z0-9_-]{20,}|x-agent-key:\s+[A-Za-z0-9_-]{8,}|sbp_[A-Za-z0-9]{16,})"
        )
        for path in paths:
            text = path.read_text(encoding="utf-8")
            self.assertIsNone(secret_pattern.search(text), msg=path)


if __name__ == "__main__":
    unittest.main()
