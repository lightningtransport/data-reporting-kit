"""Workspace access policy for signed-in Google users.

Google OAuth proves who the user is; this policy decides whether that identity
may use the reporting connector. It fails closed: no configured domain or email
means nobody is allowed.
"""
from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any


class AccessDenied(PermissionError):
    """The signed-in identity is not allowed to use the reporting connector."""


def _normalized(values: Iterable[str]) -> frozenset[str]:
    return frozenset(value.strip().lower() for value in values if value and value.strip())


def parse_list(raw: str | None) -> frozenset[str]:
    return _normalized((raw or "").split(","))


class AccessPolicy:
    def __init__(self, allowed_domains: Iterable[str], allowed_emails: Iterable[str] = ()) -> None:
        self.allowed_domains = _normalized(allowed_domains)
        self.allowed_emails = _normalized(allowed_emails)
        if not self.allowed_domains and not self.allowed_emails:
            raise ValueError("ALLOWED_EMAIL_DOMAINS or ALLOWED_EMAILS is required")

    def authorize(self, claims: Mapping[str, Any] | None) -> str:
        """Return the allowed email for these Google claims or raise AccessDenied."""
        claims = claims or {}
        user = claims.get("google_user_data") or {}
        email = str(claims.get("email") or user.get("email") or "").strip().lower()
        if not email or user.get("verified_email") is False:
            raise AccessDenied("A verified Google account is required.")
        if email in self.allowed_emails:
            return email
        # Workspace accounts carry the hosted domain (`hd`); personal Gmail does not.
        hosted_domain = str(user.get("hd") or "").strip().lower()
        email_domain = email.rsplit("@", 1)[-1]
        if hosted_domain and hosted_domain == email_domain and hosted_domain in self.allowed_domains:
            return email
        raise AccessDenied("This Google account is not authorized for Lightning reporting.")
