# LINGUA OS Project Starter V4

This repository is the shared source of truth for a two-agent development workflow:

- Codex: Core System Engineer
- Gemini: Frontend and Product UI Engineer

Gemini also uses UI UX Pro Max for design intelligence. Both agents may use Superpowers for engineering process.

## 1. Human one-time tooling setup

### Gemini complete setup

Windows PowerShell:

```powershell
./scripts/setup-gemini-agent-tools.ps1
```

macOS/Linux:

```bash
./scripts/setup-gemini-agent-tools.sh
```

This sets up:

- UI UX Pro Max
- Superpowers for Gemini CLI

### Codex Superpowers setup

Preferred official route: open Codex and send once:

```text
Fetch and follow instructions from https://raw.githubusercontent.com/obra/superpowers/refs/heads/main/.codex/INSTALL.md
```

Or use the helper scripts documented in `docs/SUPERPOWERS_SETUP.md`.

External skill installation is a human setup action. The project still works without those skills because the same workflow is written into repository policy.

## 2. Start Codex

1. Open the Codex working directory.
2. Send `CODEX_START_PROMPT.md`.
3. Codex reads `AGENTS.md` and project sources.
4. Codex selects the first unblocked READY CODEX task.

## 3. Start Gemini

1. Open the Gemini working directory.
2. Send `GEMINI_START_PROMPT.md`.
3. Gemini reads `GEMINI.md` and project sources.
4. Gemini selects the first unblocked READY GEMINI task.

## 4. Shared truth

Both agents share:

- `MASTER_PROJECT.md`
- `STATUS.md`
- `TASKS.md`
- `DECISIONS.md`
- `contracts/`
- `docs/ENGINEERING_WORKFLOW.md`
- `docs/SUPERPOWERS_POLICY.md`

Backend detail:

- `docs/CODEX_PROJECT_SPEC.md`

Frontend/UI detail:

- `docs/GEMINI_PROJECT_SPEC.md`
- `docs/UI_UX_SKILL_POLICY.md`
- `design-system/DESIGN_BRIEF.md`

Human reference DOCX files remain in `docs/reference/`.

## 5. First parallel tasks

- Codex: TASK-001
- Gemini: TASK-002

These tasks are independent.

## 6. Parallel work safety

Do not point both agents at the same mutable working tree once real parallel coding starts.

After the first Git commit, follow:

`docs/GIT_WORKTREE_WORKFLOW.md`

Recommended branches:

- `codex/core`
- `gemini/ui`

## 7. V4 engineering lifecycle

For non-trivial tasks:

spec
→ inspect
→ bounded plan
→ tests
→ implementation
→ spec review
→ code review
→ verification
→ status update

Approved specs are not brainstorm prompts. Reopen decisions only when the project has a real unresolved gap or explicit new requirement.

## 8. Backend foundation

The backend requires Python 3.12 or newer. Runtime and development dependencies are pinned in `requirements/backend.lock` and `requirements/backend-dev.lock`; the matching `.in` files record direct dependencies.

Windows PowerShell setup:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements\backend-dev.lock
Copy-Item .env.example .env
pnpm backend:check
pnpm backend:dev
```

macOS/Linux setup:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements/backend-dev.lock
cp .env.example .env
pnpm backend:check
pnpm backend:dev
```

The development server listens on `http://127.0.0.1:8000`; its operational health check is `GET /health`. TASK-001 intentionally exposes no versioned product endpoints. Use `requirements/backend.lock` for a runtime-only environment.

## 9. PostgreSQL schema and migrations

TASK-003 establishes the Supabase PostgreSQL schema under `database/migrations/`. Configure the
server-side `DATABASE_URL`, then apply or roll back the latest version with:

```powershell
pnpm db:migrate
pnpm db:rollback
```

The migration runner is transactional, checksum-verified, safe to re-run, and serializes
concurrent runners. Database integration tests require Docker Desktop or an isolated
`TEST_DATABASE_URL`. See `database/README.md` for the exact Supabase baseline and recovery rules.
