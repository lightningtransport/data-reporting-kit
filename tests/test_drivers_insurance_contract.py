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
                         "historical", "names and insurance", "no credentials", "cookies",
                         "Reject redirects", "cache bypass", "empty array",
                         "uninsured", "complement", "relational-fallback"]:
            self.assertIn(required, text)

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
