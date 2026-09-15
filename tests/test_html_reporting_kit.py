from __future__ import annotations

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
        self.assertRegex(agents, r"three calendar months|at least three calendar months")
        self.assertRegex(html_skill, r"3 months|three calendar months")

    def test_readme_start_here_points_at_html_skills(self):
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn("docs/html-reporting.md", readme)
        self.assertIn("skills/agent-reporting-html/SKILL.md", readme)
        self.assertIn("skills/reporting-html-shadcn/assets/report-ui.css", readme)

    def test_new_guidance_files_do_not_embed_secrets(self):
        paths = [
            ROOT / "docs/html-reporting.md",
            ROOT / "skills/agent-reporting-html/SKILL.md",
            ROOT / "skills/reporting-html-shadcn/SKILL.md",
            ROOT / "skills/reporting-html-shadcn/assets/report-ui.css",
        ]
        secret_pattern = re.compile(
            r"(sk-[A-Za-z0-9]{16,}|eyJ[A-Za-z0-9_-]{20,}|x-agent-key:\s+[A-Za-z0-9_-]{8,}|sbp_[A-Za-z0-9]{16,})"
        )
        for path in paths:
            text = path.read_text(encoding="utf-8")
            self.assertIsNone(secret_pattern.search(text), msg=path)


if __name__ == "__main__":
    unittest.main()
