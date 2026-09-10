#!/usr/bin/env python3
"""Authenticate a Hermes profile to the Lightning reporting gateway."""
import argparse
import base64
import getpass
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

PROJECT_URL = "https://aaqquwhdglueqlnbifvn.supabase.co"
PUBLISHABLE_KEY = "sb_publishable_UANtWEDAG0kSy2GofUxIUQ_kzbK7CY7"
SESSION_PATH = Path(os.environ.get("HERMES_HOME", str(Path.home() / ".hermes"))) / "reporting" / "lightning-session.json"


def request(url: str, payload: dict[str, Any] | None, headers: dict[str, str]) -> tuple[int, dict[str, Any]]:
    body = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            result = json.loads(response.read())
            return response.status, result if isinstance(result, dict) else {"message": str(result)}
    except urllib.error.HTTPError as exc:
        details = exc.read().decode(errors="replace")
        try:
            details = json.loads(details)
        except json.JSONDecodeError:
            pass
        return exc.code, details if isinstance(details, dict) else {"message": str(details)}


def save(session):
    SESSION_PATH.parent.mkdir(parents=True, exist_ok=True)
    SESSION_PATH.write_text(json.dumps(session))
    SESSION_PATH.chmod(0o600)


def load():
    if not SESSION_PATH.exists():
        raise SystemExit("No reporting session. Run: reporting.py login --email YOUR_EMAIL")
    return json.loads(SESSION_PATH.read_text())


def expires_soon(token):
    try:
        payload = token.split(".")[1] + "==="
        return json.loads(base64.urlsafe_b64decode(payload))["exp"] < time.time() + 60
    except Exception:
        return True


def active_session():
    session = load()
    if not expires_soon(session.get("access_token", "")):
        return session
    status, refreshed = request(
        f"{PROJECT_URL}/auth/v1/token?grant_type=refresh_token",
        {"refresh_token": session.get("refresh_token")},
        {"apikey": PUBLISHABLE_KEY, "Content-Type": "application/json"},
    )
    if status != 200:
        raise SystemExit(f"Session refresh failed ({status}). Run login again.")
    save(refreshed)
    return refreshed


def login(args):
    password = getpass.getpass(f"Supabase password for {args.email}: ")
    status, session = request(
        f"{PROJECT_URL}/auth/v1/token?grant_type=password",
        {"email": args.email, "password": password},
        {"apikey": PUBLISHABLE_KEY, "Content-Type": "application/json"},
    )
    if status != 200:
        raise SystemExit(f"Sign-in failed ({status}): {session.get('msg', session.get('message', 'unknown error'))}")
    save(session)
    print(f"Authenticated as {session.get('user', {}).get('email', args.email)}. Session saved with owner-only permissions.")


def query(args):
    try:
        filters = json.loads(args.filters)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"--filters must be JSON: {exc}")
    session = active_session()
    status, result = request(
        f"{PROJECT_URL}/functions/v1/reporting-query",
        {"report": args.report, "filters": filters},
        {"Authorization": f"Bearer {session['access_token']}", "apikey": PUBLISHABLE_KEY, "Content-Type": "application/json"},
    )
    if status != 200:
        raise SystemExit(f"Reporting request failed ({status}): {json.dumps(result)}")
    print(json.dumps(result, indent=2))


def logout(_args):
    if SESSION_PATH.exists():
        SESSION_PATH.unlink()
    print("Local reporting session removed.")


parser = argparse.ArgumentParser()
sub = parser.add_subparsers(required=True)
p = sub.add_parser("login"); p.add_argument("--email", required=True); p.set_defaults(func=login)
p = sub.add_parser("query"); p.add_argument("--report", required=True, choices=["fleet_status", "current_returns", "driver_assignments", "settlement_summary"]); p.add_argument("--filters", default="{}"); p.set_defaults(func=query)
p = sub.add_parser("logout"); p.set_defaults(func=logout)
args = parser.parse_args()
args.func(args)
