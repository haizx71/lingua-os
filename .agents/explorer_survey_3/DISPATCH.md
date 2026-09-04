## 2026-08-22T03:55:19Z
You are the Tooling & Test Explorer for LINGUA OS.
Working directory: d:/LINGUA_OS_PROJECT_STARTER/.agents/explorer_survey_3

Your task:
1. Read d:/LINGUA_OS_PROJECT_STARTER/.agents/ORIGINAL_REQUEST.md.
2. Inspect the build, tooling, and test infrastructure of the repository:
   - Root and package package.json files (dependencies, devDependencies, scripts)
   - Check if `gsap` and `@gsap/react` are installed, what versions, or if they need to be installed / configured
   - Storybook setup (.storybook, configuration, existing stories in packages/ui or apps/web)
   - Test setups (Vitest, Jest, Playwright, React Testing Library in tests/frontend or packages/ui)
   - TypeScript configs (tsconfig.json), Tailwind configs, Lint configs
   - Verification scripts: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build-storybook`, `pnpm build`
3. Document how to run tests, typecheck, lint, storybook build, and application build, along with any existing test coverage for frontend motion / reduced motion.
4. Produce a detailed tooling and test report in d:/LINGUA_OS_PROJECT_STARTER/.agents/explorer_survey_3/handoff.md following the Handoff Protocol.
5. Send a message to parent when done with the report path.
