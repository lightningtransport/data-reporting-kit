#!/usr/bin/env bash
# Synchronize the installed reporting skill from the canonical GitHub repository.
# This script updates instructions only; it never queries or changes Supabase data.
set -euo pipefail

HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
REPOSITORY="lightningtransport/data-reporting-kit"
SKILL_IDENTIFIER="$REPOSITORY/skills/itpros-supabase-reporting"
STATE_DIR="$HERMES_HOME/reporting"
STATE_FILE="$STATE_DIR/data-reporting-kit-main.sha"
REMOTE_SHA="$(git ls-remote "https://github.com/$REPOSITORY.git" refs/heads/main | cut -f1)"

if [ -z "$REMOTE_SHA" ]; then
  echo "DATA_REPORTING_KIT_SYNC_FAILED: unable to resolve $REPOSITORY main"
  exit 1
fi

if [ -f "$STATE_FILE" ] && [ "$(tr -d '[:space:]' < "$STATE_FILE")" = "$REMOTE_SHA" ]; then
  echo "DATA_REPORTING_KIT_UP_TO_DATE: $REMOTE_SHA"
  exit 0
fi

if ! hermes skills tap list | grep -Fq "$REPOSITORY"; then
  hermes skills tap add "$REPOSITORY"
fi

hermes skills install "$SKILL_IDENTIFIER" --yes

test -f "$HERMES_HOME/skills/itpros-supabase-reporting/SKILL.md"
mkdir -p "$STATE_DIR"
printf '%s\n' "$REMOTE_SHA" > "$STATE_FILE"
chmod 600 "$STATE_FILE"
echo "DATA_REPORTING_KIT_UPDATED: $REMOTE_SHA"
