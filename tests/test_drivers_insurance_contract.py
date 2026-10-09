"""Live driver-insurance source routing; no business rows or network fixtures."""
import ast
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
URL = "https://lightningtransport.ninoxdb.com/share/x9f4rn221pibyhx3lwup2f8otfzfy8kijpk2?locale=en&utcoffset=-240"
sys.path.insert(0, str(ROOT / "chatgpt-plugin/mcp-server/src"))
from knowledge import KnowledgeBase  # pyright: ignore[reportMissingImports]


class DriversInsuranceContractTests(unittest.TestCase):
    def test_all_instruction_surfaces_route_to_live_share(self):
        for path in ["AGENTS.md", "README.md", "docs/agent-rules.md",
                     "docs/curated-response-policy.md", "docs/question-routing.md",
                     "docs/metric-definitions.md", "docs/data-dictionary.md",
                     "docs/agent-reporting.md", "api/openapi.yaml",
                     "skills/itpros-supabase-reporting/SKILL.md",
                     "chatgpt-plugin/skills/lightning-reporting/SKILL.md"]:
            with self.subTest(path=path):
                self.assertTrue(URL in (ROOT / path).read_text(), f"{path}: missing live source")

    def test_source_contract_is_mirrored_and_preserves_limits(self):
        path = ROOT / "docs/drivers-insurance.md"
        self.assertTrue(path.exists(), "Missing approved driver-insurance source contract")
        text = path.read_text()
        self.assertEqual(text, (ROOT / "skills/itpros-supabase-reporting/references/drivers-insurance.md").read_text())
        for required in [URL, "30-second", "2 MiB", "immediately", "unknown/null",
                         "CDL Number", "leading zeros", "missing", "duplicate",
                         "DOB", "Hire of Date", "State", "Years_of_Experience",
                         "First Name", "Last Name", "Insurance", "Gender",
                         "historical", "full approved public field set", "no credentials", "cookies",
                         "Reject redirects", "cache bypass", "empty array",
                         "uninsured", "complement", "relational-fallback"]:
            self.assertIn(required, text)

    def test_full_public_columns_and_native_routing(self):
        keys = ["First Name", "Last Name", "Insurance", "CDL Number", "Gender",
                "DOB", "State", "Hire of Date", "Years_of_Experience"]
        for path in ["docs/drivers-insurance.md",
                     "skills/itpros-supabase-reporting/references/drivers-insurance.md",
                     "docs/question-routing.md", "api/openapi.yaml"]:
            with self.subTest(path=path):
                text = (ROOT / path).read_text()
                self.assertIn("query_drivers_insurance", text)
                for key in keys:
                    self.assertIn(key, text)
                self.assertIn("omit absent keys", text)
                self.assertIn("never invent", text)
        routing = (ROOT / "docs/question-routing.md").read_text()
        for phrase in ["active on insurance", "all insurance driver data",
                       "Do not substitute", "agent-reporting `drivers`"]:
            self.assertIn(phrase, routing)

    def test_no_narrow_client_projection_or_host_only_policies(self):
        import re
        paths = ["AGENTS.md", "README.md", "docs/agent-rules.md",
                 "docs/curated-response-policy.md", "docs/data-dictionary.md",
                 "docs/metric-definitions.md", "docs/agent-reporting.md",
                 "docs/question-routing.md", "docs/drivers-insurance.md",
                 "skills/itpros-supabase-reporting/SKILL.md",
                 "skills/itpros-supabase-reporting/references/drivers-insurance.md",
                 "chatgpt-plugin/skills/lightning-reporting/SKILL.md"]
        for path in paths:
            with self.subTest(path=path):
                text = (ROOT / path).read_text()
                self.assertNotRegex(text, re.compile(
                    r"(?:show|output) names and insurance by default|"
                    r"names and insurance(?: labels)? only", re.I))
                self.assertNotIn("preview 20", text)
        contract = (ROOT / "docs/drivers-insurance.md").read_text()
        self.assertIn("chat and Excel", contract)
        self.assertIn("sparse", contract)
        self.assertIn("not Supabase `drivers`", contract)

    def test_actual_mcp_registry_search_fetch_exposes_contract(self):
        tree = ast.parse((ROOT / "chatgpt-plugin/mcp-server/src/server.py").read_text())
        nodes: list[ast.stmt] = [node for node in tree.body if
                 isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and
                 t.id in {"DOCUMENT_PATHS", "REPOSITORY_URL"} for t in node.targets)
                 or isinstance(node, ast.FunctionDef) and node.name == "load_knowledge"]
        namespace = {"Path": Path, "KnowledgeBase": KnowledgeBase}
        exec(compile(ast.Module(body=nodes, type_ignores=[]), "server.py", "exec"), namespace)
        self.assertIn("docs/drivers-insurance.md", namespace["DOCUMENT_PATHS"])
        base = namespace["load_knowledge"](ROOT)
        for question in ["Drivers Insurance", "list drivers with insurance"]:
            self.assertIn("docs/drivers-insurance.md", [r["id"] for r in base.search(question)["results"]])
        self.assertIn(URL, base.fetch("docs/drivers-insurance.md")["text"])


if __name__ == "__main__":
    unittest.main()
