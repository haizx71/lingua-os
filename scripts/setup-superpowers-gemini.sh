#!/usr/bin/env bash
set -euo pipefail

command -v gemini >/dev/null 2>&1 || { echo "Gemini CLI is required." >&2; exit 1; }

if ! gemini extensions install https://github.com/obra/superpowers; then
  echo "Install did not succeed. Trying to update an existing extension..."
  gemini extensions update superpowers
fi

echo "Superpowers is available to Gemini CLI. Restart the Gemini session if needed."
