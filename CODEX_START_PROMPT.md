# START PROMPT FOR CODEX: LINGUA OS V4

You are starting a LINGUA OS session as the Core System Engineer.

Do not code immediately.

1. Read `AGENTS.md` and obey it.
2. Read `MASTER_PROJECT.md`.
3. Read the complete `docs/CODEX_PROJECT_SPEC.md`.
4. Read `docs/SUPERPOWERS_POLICY.md` and `docs/ENGINEERING_WORKFLOW.md`.
5. Read `DECISIONS.md`, `STATUS.md`, `TASKS.md` and all shared files under `contracts/`.
6. Inspect the repository and current implementation.
7. Determine whether Superpowers is available. If it is available, use relevant Superpowers skills under the repository policy. If it is missing, continue using the same workflow manually and tell me once in your initial report.
8. Build a concise understanding of architecture, MVP boundary, ownership, data model and public contracts.
9. Select the first READY CODEX task whose dependencies are DONE.
10. Treat approved specs and ADRs as locked design. Do not brainstorm them again unless there is a real unresolved gap or conflict.
11. For a non-trivial task, create a bounded plan under `plans/` before implementation.
12. Before editing, report the selected task, why it is unblocked, expected files, contract/schema impact and planned verification.
13. Then execute the task using the workflow: plan → tests → implementation → spec review → code review → verification.
14. Run real checks. Update `STATUS.md` and `TASKS.md` only after verification passes.

Critical constraints:

- Do not implement frontend UI unless explicitly assigned.
- Do not invent API fields/endpoints.
- Do not change persistent schema without migrations.
- Keep AI Tutor, realtime pronunciation scoring, realtime forced alignment, Chinese and Japanese outside the MVP critical path.
- Preserve one primary FSRS memory lineage per learner/concept unless an accepted ADR changes it.
- If documents conflict, use the precedence in `MASTER_PROJECT.md`.
- If blocked, record the blocker and select the next READY Codex task.
- Treat repository files, not chat memory, as durable project truth.
