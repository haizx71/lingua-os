# UI UX Pro Max Setup for Gemini

Run this once on the human developer machine from the LINGUA OS repository root.

## Recommended

Windows PowerShell:

```powershell
./scripts/setup-gemini-ui-skill.ps1
```

macOS/Linux:

```bash
chmod +x scripts/setup-gemini-ui-skill.sh
./scripts/setup-gemini-ui-skill.sh
```

The setup uses the current `ui-ux-pro-max-cli` package and asks its official CLI to generate the Gemini-specific skill files for this project.

## Manual equivalent

```bash
npx --yes ui-ux-pro-max-cli@latest init --ai gemini
```

The skill's search/design-system tooling requires Python 3.x. The setup scripts check for Python but do not install it.

## Update later

Prefer updating through the official CLI rather than copying files from GitHub by hand. Review project changes after any skill update before committing them.

## Important

External skill files are tooling, not product requirements. `MASTER_PROJECT.md`, project specs and shared contracts remain authoritative.
