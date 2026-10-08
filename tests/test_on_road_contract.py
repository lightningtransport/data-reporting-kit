"""Current operational-source routing and actual MCP knowledge registry regression."""
import ast
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
URL = "https://lightningtransport.ninoxdb.com/share/eno5u22ebn2qdn215dpzwn02squ5wsixob8f?locale=en&utcoffset=-240"
sys.path.insert(0, str(ROOT / "chatgpt-plugin/mcp-server/src"))
from knowledge import KnowledgeBase  # pyright: ignore[reportMissingImports]


class OnRoadContractTests(unittest.TestCase):
    def test_all_instruction_surfaces_route_current_working_trucks_to_live_source(self):
        for path in ["AGENTS.md", "README.md", "docs/agent-rules.md", "docs/curated-response-policy.md",
                     "docs/question-routing.md", "docs/metric-definitions.md", "docs/data-dictionary.md",
                     "docs/agent-reporting.md", "docs/html-reporting.md", "api/openapi.yaml",
                     "skills/itpros-supabase-reporting/SKILL.md", "supabase/functions/agent-reporting/metadata.ts"]:
            with self.subTest(path=path):
                text = (ROOT / path).read_text()
                self.assertTrue(URL in text, f"{path}: missing approved current source")
                self.assertIn("historical", text.lower())
                self.assertNotIn('today in America/New_York for “now”', text)
                self.assertNotIn('today in the requested business timezone for "now"', text)
                self.assertNotIn('On road today is DriverPay-only', text)

    def test_source_contract_is_self_contained_and_mirrored(self):
        text = (ROOT / "docs/on-road-trucks.md").read_text()
        self.assertEqual(text, (ROOT / "skills/itpros-supabase-reporting/references/on-road-trucks.md").read_text())
        for required in [URL, "30-second", "2 MiB", "On The Road Working", "truck_number", "Samsara_Truck_ID", "Ninox_ID", "dispatcher", "insurance", "owner", "null", "zero", "GPS", "immediately", "historical", "duplicate", "credentials"]:
            self.assertIn(required, text)

    def test_actual_mcp_registry_load_search_fetch_exposes_both_live_contracts(self):
        # Execute the actual registry and loader without importing optional FastMCP transport.
        tree = ast.parse((ROOT / "chatgpt-plugin/mcp-server/src/server.py").read_text())
        nodes: list[ast.stmt] = [node for node in tree.body if
                 isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id in {"DOCUMENT_PATHS", "REPOSITORY_URL"} for t in node.targets)
                 or isinstance(node, ast.FunctionDef) and node.name == "load_knowledge"]
        namespace = {"Path": Path, "KnowledgeBase": KnowledgeBase}
        exec(compile(ast.Module(body=nodes, type_ignores=[]), "server.py", "exec"), namespace)
        base = namespace["load_knowledge"](ROOT)
        for path, query in [("docs/on-road-trucks.md", "live on road working trucks"), ("docs/off-duty-trucks.md", "live off duty trucks")]:
            self.assertIn(path, namespace["DOCUMENT_PATHS"])
            self.assertIn(path, [r["id"] for r in base.search(query)["results"]])
            self.assertIn("Ninox", base.fetch(path)["text"])


if __name__ == "__main__":
    unittest.main()
