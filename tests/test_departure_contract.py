"""Synthetic contract/document checks; no credentials or live business rows."""
from __future__ import annotations

import re
import unittest
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]


class DepartureContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.spec = yaml.safe_load((ROOT / "api/openapi.yaml").read_text())
        cls.schema = {"$ref": "#/components/schemas/DepartureDataResponse", "components": cls.spec["components"]}
        cls.validator = Draft202012Validator(cls.schema, format_checker=FormatChecker())

    def envelope(self, complete=True):
        names = ("driver_pay_count", "schedule_teams_count", "driver_pay_only_count", "schedule_teams_only_count", "overlap_count", "combined_distinct_total")
        sets = ("driver_pay", "schedule_teams", "driver_pay_only", "schedule_teams_only", "overlap", "combined")
        return {
            "schema_version": "3.8.3", "report": "departures", "source": "synthetic two-source fixture",
            "filters": {"out_from": "2026-10-05", "out_to": "2026-10-11"},
            "offset": 0, "limit": 100, "count": 1,
            "page_count": 1, "total_count": 1,
            "has_more": False, "next_offset": None,
            "as_of": "2026-10-06T12:00:00Z", "request_id": "11111111-1111-4111-8111-111111111111",
            "period": {"out_from": "2026-10-05", "out_to": "2026-10-11", "time_zone": "America/New_York"},
            "status": "complete" if complete else "incomplete", "complete": complete,
            "reconciliation": {key: 0 if complete else None for key in names},
            "truck_sets": {key: [] if complete else None for key in sets},
            "source_status": {}, "data": [{}],
        }

    def test_openapi_new_reports_and_version(self):
        self.assertEqual(self.spec["info"]["version"], "3.8.3")
        parameters = self.spec["paths"]["/agent-reporting"]["get"]["parameters"]
        reports = next(p["schema"]["enum"] for p in parameters if p["name"] == "report")
        self.assertTrue({"out_schedule", "departures"}.issubset(reports))
        for schema in self.spec["components"]["schemas"].values():
            Draft202012Validator.check_schema(schema)

    def test_aggregate_complete_and_failed_source_envelopes(self):
        for complete in (True, False):
            with self.subTest(complete=complete):
                self.validator.validate(self.envelope(complete))

    def test_failed_source_cannot_claim_total_or_complete_status(self):
        for mutation in ({"status": "complete"}, {"reconciliation": {**self.envelope(False)["reconciliation"], "combined_distinct_total": 0}}):
            payload = {**self.envelope(False), **mutation}
            self.assertTrue(list(self.validator.iter_errors(payload)))

    def test_complete_aggregate_cannot_have_unknown_combined_total(self):
        payload = self.envelope()
        payload["reconciliation"]["combined_distinct_total"] = None
        self.assertTrue(list(self.validator.iter_errors(payload)))

    def test_failed_schedule_has_unknown_row_total_and_no_persistent_id(self):
        payload = {**self.envelope(False), "report": "out_schedule", "total_count": None,
                   "count": 0, "page_count": 0, "data": []}
        for key in ("reconciliation", "truck_sets"):
            del payload[key]
        self.validator.validate(payload)
        payload = {**self.envelope(), "report": "out_schedule",
                   "data": [{"Truck": 101, "Out Date": "2026-10-05"}]}
        payload["data"][0]["solo"] = "Yes"
        self.validator.validate(payload)
        payload["data"][0]["Driver_1_DriversDB_Id"] = 99
        self.assertTrue(list(self.validator.iter_errors(payload)))

    def test_new_envelope_does_not_match_old_data_branch(self):
        schema = {"$ref": "#/components/schemas/AgentDataResponse", "components": self.spec["components"]}
        self.assertTrue(list(Draft202012Validator(schema).iter_errors(self.envelope())))

    def test_governed_docs_preserve_client_limitation_and_same_window_rule(self):
        text = (ROOT / "docs/departures.md").read_text()
        for token in ("not integrated", "31 inclusive days", "America/New_York", "REPORTS", "combined_distinct_total", "DriverPay + live Ninox Schedule_Teams"):
            self.assertIn(token, text)
        for path in ("AGENTS.md", "docs/agent-rules.md", "docs/curated-response-policy.md", "docs/question-routing.md", "skills/itpros-supabase-reporting/SKILL.md"):
            doc = (ROOT / path).read_text()
            self.assertNotIn("Departures use `DriverPay.Out Date` only", doc)
            self.assertNotIn("Departures use only `DriverPay.Out Date`", doc)
            self.assertIn("departures", doc)
            self.assertIn("not integrated", doc)

    def test_changed_document_links_resolve(self):
        paths = [ROOT / "AGENTS.md", ROOT / "README.md", *ROOT.glob("docs/*.md"), *ROOT.glob("skills/*/SKILL.md"), ROOT / "chatgpt-plugin/README.md", *ROOT.glob("chatgpt-plugin/skills/*/SKILL.md")]
        errors = []
        for path in paths:
            for target in re.findall(r"(?<!!)\[[^\]]*\]\(([^)]+)\)", path.read_text()):
                if target.startswith(("http:", "https:", "#", "mailto:")):
                    continue
                local = target.split("#", 1)[0]
                if local and not (path.parent / local).exists():
                    errors.append(f"{path.relative_to(ROOT)}: {target}")
        self.assertEqual(errors, [])

    def test_feedback_schema_mirror_is_identical(self):
        self.assertEqual((ROOT / "schemas/correction-feedback-event.schema.json").read_bytes(), (ROOT / "skills/itpros-supabase-reporting/references/correction-feedback-event.schema.json").read_bytes())


if __name__ == "__main__":
    unittest.main()
