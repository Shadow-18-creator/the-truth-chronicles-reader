# Automated testing and code modularity

## Goal
Add a repeatable automated test suite and improve separation around key app workflows while preserving existing behavior, styling, and integrations.

## Work
- Add Vitest, React Testing Library, jest-dom, and jsdom; configure a dedicated test environment and `npm test` script, keeping the existing Bun lockfile consistent with dependency changes.
- Move the existing TinyFish tests into the new `src/__tests__/` suite and convert them to Vitest, retaining privacy-boundary coverage and adding prompt/research failure cases.
- Add focused tests for shared utilities and representative reader/author UI workflows, including empty inputs and API error states. Mock external services and authentication so tests run without live credentials or production data.
- Extract only the prompt construction and service logic needed for meaningful isolated tests into small typed modules; document new public helpers with JSDoc, remove unused imports, and avoid broad component rewrites.
- Update `README.md` with install/test commands and a concise overview of the current TanStack Start, React, and Lovable Cloud architecture.

## Validation
- Run the complete Vitest suite and TypeScript/build checks; fix issues introduced by the work.
- Confirm the existing app integrations and visible styling remain unchanged.

## Technical details
- Use Vitest with jsdom for UI tests and React Testing Library for accessible interaction assertions.
- Keep tests deterministic: mock network, AI, voice, and database boundaries; do not invoke live AI providers.
- Keep tests under `src/__tests__/`; use small unit-testable modules for prompts/services rather than coupling tests to server-only route handlers.