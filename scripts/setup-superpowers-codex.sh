#!/usr/bin/env bash
set -euo pipefail

TARGET="$HOME/.codex/superpowers"
SKILLS_DIR="$HOME/.agents/skills"
LINK="$SKILLS_DIR/superpowers"

if [ -d "$TARGET/.git" ]; then
  git -C "$TARGET" pull --ff-only
else
  git clone https://github.com/obra/superpowers.git "$TARGET"
fi

mkdir -p "$SKILLS_DIR"
if [ -L "$LINK" ] || [ -e "$LINK" ]; then
  rm -rf "$LINK"
fi
ln -s "$TARGET/skills" "$LINK"

echo "Superpowers installed for Codex. Restart Codex before use."
