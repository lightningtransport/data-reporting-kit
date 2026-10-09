"""Sanitized documentation contract; not importer or historical-client evidence."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class SettlementGuidanceContractTests(unittest.TestCase):
    def text(self, path):
        return (ROOT / path).read_text()

    def test_canonical_and_packaged_guidance_link_numeric_coverage(self):
        for path in ('AGENTS.md', 'docs/agent-rules.md',
                     'docs/curated-response-policy.md', 'docs/question-routing.md',
                     'docs/data-dictionary.md',
                     'skills/itpros-supabase-reporting/SKILL.md',
                     'chatgpt-plugin/skills/lightning-reporting/SKILL.md'):
            with self.subTest(path=path):
                self.assertIn('Settlement numeric coverage', self.text(path))

    def test_metric_contract_distinguishes_value_states_and_preserves_finances(self):
        text = self.text('docs/metric-definitions.md')
        self.assertIn('### Settlement numeric coverage', text)
        for phrase in ('all-null', 'absent projected key', 'numeric zero',
                       'Decimal', 'populated/null counts', 'From', 'To',
                       'not automatically zero', 'not numeric measures',
                       'stored `Total Expenses` and `Net`'):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, text)

    def test_identity_and_import_evidence_do_not_claim_a_deployed_importer(self):
        text = self.text('docs/data-dictionary.md')
        for phrase in ('Settlement source verification', 'Ninox_ID',
                       'not exposed by the settlement report',
                       'raw REST record omission', 'evaluated',
                       'scheduled Supabase settlement importer was not located',
                       'ad-hoc', 'separate approval'):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, text)

    def test_package_version_and_changelog_distribute_docs_only_release(self):
        skill = self.text('skills/itpros-supabase-reporting/SKILL.md')
        version = re.search(r'(?m)^version: (\d+)\.(\d+)\.(\d+)$', skill)
        self.assertIsNotNone(version)
        assert version is not None
        self.assertGreaterEqual(tuple(map(int, version.groups())), (0, 11, 6))
        changelog = self.text('CHANGELOG.md')
        self.assertIn('Settlement clarification / client skill 0.11.6', changelog)
        self.assertIn('No function-source or runtime-metadata change', changelog)
        self.assertIn('client adapter', changelog)


if __name__ == '__main__':
    unittest.main()
