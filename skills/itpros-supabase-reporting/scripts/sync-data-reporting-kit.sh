#!/usr/bin/env bash
# Synchronize the installed reporting skill from the canonical GitHub repository.
# This script updates instructions only; it never queries or changes Supabase data.
set -euo pipefail

HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
REPOSITORY="lightningtransport/data-reporting-kit"
REPOSITORY_URL="https://github.com/$REPOSITORY.git"
SKILL_PATH="skills/itpros-supabase-reporting"
CACHE_DIR="$HERMES_HOME/cache/data-reporting-kit"
TARGET_DIR="$HERMES_HOME/skills/itpros-supabase-reporting"
STATE_DIR="$HERMES_HOME/reporting"
STATE_FILE="$STATE_DIR/data-reporting-kit-main.sha"

if ! command -v git >/dev/null 2>&1; then
  echo "DATA_REPORTING_KIT_SYNC_FAILED: git is required"
  exit 1
fi

if [ -d "$CACHE_DIR/.git" ]; then
  git -C "$CACHE_DIR" fetch --depth 1 origin main
  git -C "$CACHE_DIR" checkout --detach --force FETCH_HEAD
else
  rm -rf "$CACHE_DIR"
  mkdir -p "$(dirname "$CACHE_DIR")"
  git clone --depth 1 --branch main "$REPOSITORY_URL" "$CACHE_DIR"
fi

REMOTE_SHA="$(git -C "$CACHE_DIR" rev-parse HEAD)"
SOURCE_DIR="$CACHE_DIR/$SKILL_PATH"
if [ ! -f "$SOURCE_DIR/SKILL.md" ]; then
  echo "DATA_REPORTING_KIT_SYNC_FAILED: reporting skill missing at canonical revision $REMOTE_SHA"
  exit 1
fi

if [ -f "$STATE_FILE" ] && [ "$(tr -d '[:space:]' < "$STATE_FILE")" = "$REMOTE_SHA" ] && [ -f "$TARGET_DIR/SKILL.md" ]; then
  echo "DATA_REPORTING_KIT_UP_TO_DATE: $REMOTE_SHA"
  exit 0
fi

mkdir -p "$STATE_DIR/backups" "$HERMES_HOME/skills"
STAGE_DIR="$(mktemp -d "$HERMES_HOME/skills/.itpros-supabase-reporting.stage.XXXXXX")"
trap 'rm -rf "$STAGE_DIR"' EXIT
cp -R "$SOURCE_DIR/." "$STAGE_DIR/"

if [ -d "$TARGET_DIR" ]; then
  BACKUP_DIR="$STATE_DIR/backups/itpros-supabase-reporting-$(date -u +%Y%m%dT%H%M%SZ)"
  mv "$TARGET_DIR" "$BACKUP_DIR"
fi
mv "$STAGE_DIR" "$TARGET_DIR"
trap - EXIT

mkdir -p "$STATE_DIR"
printf '%s\n' "$REMOTE_SHA" > "$STATE_FILE"
chmod 600 "$STATE_FILE"
echo "DATA_REPORTING_KIT_UPDATED: $REMOTE_SHA"
