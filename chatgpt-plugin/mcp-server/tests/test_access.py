from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

from access import AccessDenied, AccessPolicy, parse_list


def claims(email: str, hd: str | None = None, verified: bool = True) -> dict:
    user = {"email": email, "verified_email": verified}
    if hd:
        user["hd"] = hd
    return {"email": email, "google_user_data": user}


class AccessPolicyTests(unittest.TestCase):
    def test_workspace_account_in_allowed_domain_is_authorized(self):
        policy = AccessPolicy(parse_list("lightning.example, other.example"))

        self.assertEqual(policy.authorize(claims("Ana@Lightning.example", hd="lightning.example")), "ana@lightning.example")

    def test_personal_account_spoofing_the_domain_without_hd_is_denied(self):
        policy = AccessPolicy(["lightning.example"])

        with self.assertRaises(AccessDenied):
            policy.authorize(claims("ana@lightning.example"))

    def test_other_workspace_and_unverified_accounts_are_denied(self):
        policy = AccessPolicy(["lightning.example"])

        with self.assertRaises(AccessDenied):
            policy.authorize(claims("ana@rival.example", hd="rival.example"))
        with self.assertRaises(AccessDenied):
            policy.authorize(claims("ana@lightning.example", hd="lightning.example", verified=False))
        with self.assertRaises(AccessDenied):
            policy.authorize(None)

    def test_explicit_email_allowlist_admits_a_single_outside_account(self):
        policy = AccessPolicy([], parse_list("contractor@gmail.com"))

        self.assertEqual(policy.authorize(claims("contractor@gmail.com")), "contractor@gmail.com")

    def test_empty_policy_fails_closed(self):
        with self.assertRaisesRegex(ValueError, "required"):
            AccessPolicy(parse_list(""), parse_list(" , "))


if __name__ == "__main__":
    unittest.main()
