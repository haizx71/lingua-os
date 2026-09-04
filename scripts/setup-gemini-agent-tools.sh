#!/usr/bin/env bash
set -euo pipefail

"$(dirname "$0")/setup-gemini-ui-skill.sh"
"$(dirname "$0")/setup-superpowers-gemini.sh"

echo "Gemini tooling setup complete: UI UX Pro Max + Superpowers."
