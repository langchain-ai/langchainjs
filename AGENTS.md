# LangChain.js

LangChain.js is a framework and ecosystem for building context-aware, LLM-powered applications with composable components, stateful agents, and production tooling.

## Overview

- Provides composable building blocks, chains, agents, and LangGraph tooling for LLM applications targeting Node.js, edge runtimes, browsers, and Deno
- Monorepo managed with pnpm and TurboRepo; key workspaces include `@langchain/core` (base abstractions), `langchain` (chains/agents), and numerous provider packages under `libs/providers/` and `libs/langchain-community/`
- Source lives across `langchain-core/`, `langchain/`, and `libs/*`; examples and notebooks are in `examples/` and `cookbook/`

## Key Technologies and Frameworks

- TypeScript targeting Node.js v20+ (repo `.nvmrc` pins v24.6.0)
- pnpm workspaces (`pnpm-workspace.yaml`) with TurboRepo task orchestration (`turbo.json`)
- Vitest and Jest (via Turbo) for unit and integration testing
- ESLint and Prettier for linting/formatting
- Docker Compose for environment and integration test matrices
- Documentation generation: TypeDoc (API refs) and Docusaurus (site)

## Constraints and Requirements

- Use Node.js ≥20; maintainers develop against Node v24.6.0 (see `.nvmrc`)
- Prioritize parity with the Python LangChain APIs; propose new abstractions via issues before implementation
- Optional third-party integrations should live in appropriate `libs/providers/` packages and list optional dependencies in package configs and entrypoint metadata

## Challenges and Mitigation Strategies

- **Environment breadth**: LangChain.js must run across Node ESM/CJS, edge runtimes, and browsers. Rely on environment tests (`pnpm test:exports:docker`) to validate builds across targets.
- **Third-party dependency surface**: New integrations may require credentials or heavy dependencies. Gate them behind optional peer deps and provide `.env`-driven configuration for integration tests.

## Development Workflow

- Install workspace deps: `pnpm install`
- Build core packages before depending packages, e.g.:
  - `cd libs/langchain-core && pnpm install && pnpm build`
  - Return to repo root for aggregate builds: `pnpm build`
- Run linting/formatting: `pnpm lint`, `pnpm lint:fix`, `pnpm format`, `pnpm format:check`
- Run tests:
  - Unit suite: `pnpm test` (alias for `pnpm test:unit` plus exports tests)
  - Integration deps up/down: `pnpm test:int:deps`, `pnpm test:int`, `pnpm test:int:deps:down`
  - Environment/exports matrix (Docker required): `pnpm test:exports:docker`
  - Dependency range tests (Docker required): `pnpm test:ranges:docker`
- Watch build utilities: `pnpm --filter @langchain/build watch`
- Release a package (maintainers): `pnpm release <workspace>` run on a clean `main`

## Coding Guidelines

- Follow TypeScript strictness defined in package `tsconfig` files; prefer composable abstractions aligned with `@langchain/core`
- Use Prettier (`.prettierrc`) and ESLint (`@langchain/eslint` presets) before submitting PRs
- Add new public entrypoints in `langchain/langchain.config.js` or `libs/langchain-community/langchain.config.js`, and flag integrations requiring optional deps
- Place tests alongside source (`tests/*.test.ts` for unit, `*.int.test.ts` for integration)

## Pull Request Guidelines

- Fork-and-PR workflow only; do not push directly to upstream unless you are a maintainer
- Assign yourself to issues you are addressing and keep scope focused
- Discuss new abstractions or major API changes in an issue before implementation
- Run linting, formatting, and relevant tests (unit, integration, exports) before requesting review; note any tests not run and why

## Debugging and Troubleshooting

- Use `nvm use` or similar to ensure Node v24.x; mismatched Node versions often break dependency installation
- If missing new core export in dependents, rebuild `libs/langchain-core` then rerun dependent build/tests
- Docker must be running for `test:exports:docker`, `test:ranges:docker`, and integration dependencies
- Integration tests may need provider credentials; place them in `langchain/.env` or `libs/<pkg>/.env` as referenced in test docs
- If Turbo caches stale artifacts, clear with `pnpm clean` or remove `.turbo/` in the affected workspace

## Environment & Platform Support

- Target runtimes: Node.js (CJS + ESM), Edge (Cloudflare Workers, Vercel Edge, Supabase Edge), Browser, Deno.
- Ensure code avoids Node-only APIs unless guarded or documented; rely on abstractions in `@langchain/core` when possible.
