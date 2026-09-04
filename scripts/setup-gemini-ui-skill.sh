#!/usr/bin/env bash
set -euo pipefail

echo "LINGUA OS - UI UX Pro Max setup for Gemini"

command -v node >/dev/null 2>&1 || { echo "Node.js is required." >&2; exit 1; }
command -v npx >/dev/null 2>&1 || { echo "npx is required." >&2; exit 1; }

if ! command -v python3 >/dev/null 2>&1 && ! command -v python >/dev/null 2>&1; then
  echo "Warning: Python 3.x was not detected. The skill search/design-system script requires Python 3.x." >&2
fi

npx --yes ui-ux-pro-max-cli@latest init --ai gemini

echo "Done. Reload the Gemini workspace if needed."
echo "Next: send GEMINI_START_PROMPT.md to Gemini."
