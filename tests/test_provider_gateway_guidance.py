"""Public guidance contracts; no production traces, provider keys, or business rows."""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ANCHOR = 'provider-versus-gateway-troubleshooting'


class ProviderGatewayGuidanceTests(unittest.TestCase):
    def test_provider_failure_is_not_automatically_a_reporting_outage(self):
        guide = (ROOT / 'docs/agent-reporting.md').read_text()
        self.assertIn('## Provider versus gateway troubleshooting', guide)
        section = guide.split('## Provider versus gateway troubleshooting', 1)[1].split('\n## ', 1)[0]
        for phrase in (
            'TimeoutError', 'Provider generation failed', 'not proof',
            'successful model generation', 'tool envelopes',
            'catalog', 'metadata', 'bounded', 'HTTP status', 'as_of',
            'current replay does not establish historical causation',
            'public status', 'deployment-linked', 'credits', 'quotas',
            'unrelated local', 'unknown',
            'AI model service is temporarily unavailable',
            'model identity', 'failover', 'client adapter',
            'auth', 'pagination', 'numeric validation',
            'private', 'raw chat',
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, section)
        for path, target in (
            ('AGENTS.md', f'docs/agent-reporting.md#{ANCHOR}'),
            ('docs/agent-rules.md', f'agent-reporting.md#{ANCHOR}'),
            ('docs/curated-response-policy.md', f'agent-reporting.md#{ANCHOR}'),
            ('skills/itpros-supabase-reporting/SKILL.md', f'../../docs/agent-reporting.md#{ANCHOR}'),
            ('chatgpt-plugin/skills/lightning-reporting/SKILL.md', f'../../../docs/agent-reporting.md#{ANCHOR}'),
        ):
            with self.subTest(path=path):
                text = (ROOT / path).read_text()
                self.assertIn(target, text)
                self.assertIn('not proof of a reporting gateway outage', text)

    def test_instruction_release_bumps_sync_version_without_api_deployment(self):
        import re
        skill = (ROOT / 'skills/itpros-supabase-reporting/SKILL.md').read_text()
        version = re.search(r'(?m)^version: (\d+)\.(\d+)\.(\d+)$', skill)
        self.assertIsNotNone(version)
        assert version is not None
        self.assertGreaterEqual(tuple(map(int, version.groups())), (0, 11, 9))
        changelog = (ROOT / 'CHANGELOG.md').read_text()
        self.assertIn('Provider/gateway troubleshooting / client skill 0.11.9', changelog)
        release = changelog.split('Provider/gateway troubleshooting / client skill 0.11.9', 1)[1].split('\n## ', 1)[0]
        for phrase in ('instruction-only', 'No function-source or runtime-metadata change',
                       'No database', 'model identity', 'failover', 'private',
                       'not proof of native-client rollout'):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, release)


if __name__ == '__main__':
    unittest.main()
