# Superpowers Setup

Superpowers is optional tooling at machine level, but it is the approved engineering-process skill for this repository.

Official repository:
`https://github.com/obra/superpowers`

## Codex

Preferred official quick setup:

Open Codex and give it this instruction once:

`Fetch and follow instructions from https://raw.githubusercontent.com/obra/superpowers/refs/heads/main/.codex/INSTALL.md`

The repository also contains helper scripts for the documented manual installation route:

Windows PowerShell:

```powershell
./scripts/setup-superpowers-codex.ps1
```

macOS/Linux:

```bash
./scripts/setup-superpowers-codex.sh
```

Restart Codex after installation.

## Gemini CLI

Official install command:

```bash
gemini extensions install https://github.com/obra/superpowers
```

Update later with:

```bash
gemini extensions update superpowers
```

Helper scripts:

Windows PowerShell:

```powershell
./scripts/setup-superpowers-gemini.ps1
```

macOS/Linux:

```bash
./scripts/setup-superpowers-gemini.sh
```

## Gemini complete tooling setup

LINGUA OS uses both UI UX Pro Max and Superpowers for Gemini.

Windows:

```powershell
./scripts/setup-gemini-agent-tools.ps1
```

macOS/Linux:

```bash
./scripts/setup-gemini-agent-tools.sh
```

Installation is a human setup action. Agents must not silently install or update machine-level tools.
