# LangChain.js

## Overview

- Framework for building LLM-powered applications (context-aware + reasoning) in JavaScript/TypeScript.
- Monorepo containing core abstractions, community integrations, higher-level chains/agents/retrieval strategies, documentation site sources, examples, internal tooling, and auxiliary packages.
- Primary published packages referenced in this repo:
  - `@langchain/core`: Base abstractions.
  - `@langchain/community`: Third-party integrations (under `libs/langchain-community`).
  - `langchain`: Chains, agents, retrieval strategies, entrypoint map (`langchain/`).
  - Additional integration-specific packages under `libs/*` (e.g. `@langchain/google-genai`, etc.).
  - LangGraph (external repo) integrates with these packages; not maintained directly here.

### Workspace Structure (root `package.json` workspaces)

```
langchain
langchain-core
libs/*                (community + integration packages)
examples              (runnable usage examples)
docs/*                (documentation site + API refs)
internal/*            (supporting scripts/tests/utilities)
```

### Key Subdirectories

- `langchain/`: Source for `langchain` package (entrypoint definitions in `langchain.config.js`).
- `langchain-core/`: Core abstractions (referenced by others).
- `libs/langchain-community/`: Third-party integrations (default location for new integrations).
- `examples/`: Example scripts, can be invoked via root scripts.
- `docs/core_docs`, `docs/api_refs`: Documentation generation/rendering workspaces.
- `environment_tests/`, `dependency_range_tests/`: Docker-based cross-environment & dependency range validation.

## Key Technologies and Tooling

- Language: TypeScript (Node.js >= 18; ESM + CJS build output).
- Package manager: Yarn 3.5.1 (PnP) (`"packageManager": "yarn@3.5.1"`).
- Task orchestration & caching: Turborepo (`turbo.json`).
- Linting: ESLint.
- Formatting: Prettier.
- Testing: Jest (unit + integration), plus environment/export tests via Docker.
- Documentation: TypeDoc (API refs), Docusaurus (site), Quarto (Notebook -> MD conversions), Notebooks (Deno runtime import style).
- Release tooling: Custom release script (`yarn release`) with Changesets + `release_workspace.js`.
- Docker: Used for environment tests and some release validation (`test:exports:docker`).

## Constraints and Requirements

- Node.js version: `>=18` (supported: 18.x, 19.x, 20.x, 22.x per README).
- Maintain API parity (where feasible) with Python LangChain for core abstractions; new abstractions should be discussed first.
- Monorepo packages rely on consistent entrypoints defined in `langchain/langchain.config.js` (agents, tools, chains, retrievers, etc.). Adding new entrypoints requires editing that config; integration entrypoints needing optional deps must be listed in `requiresOptionalDependency` array.
- Yarn PnP: Do not rely on `node_modules` resolution hacks; declare dependencies explicitly.
- Large matrix of optional third-party integrations: Keep integration code in community or dedicated `libs/*` packages; avoid bloating core.

## Entry Points (Excerpt from `langchain/langchain.config.js`)

The `config.entrypoints` map exposes subpath imports (e.g. `langchain/agents`, `langchain/tools/sql`). Optional integrations requiring third-party deps are listed under `config.requiresOptionalDependency` to control export/testing and docs inclusion.

## Challenges and Mitigation Strategies

- Optional dependency handling: Use `requiresOptionalDependency` to avoid bundling when dependencies absent.
- Multi-environment compatibility (Node, Edge, Browser, Deno): Use environment tests (`environment_tests/` + `yarn test:exports:docker`) to validate export forms (ESM/CJS) and platform-specific execution.
- API parity with Python: Review Python implementation before introducing divergent abstractions; open issue for discussion first.

## Development Workflow

### Install & Bootstrap

```bash
yarn                # installs all workspace dependencies (Yarn 3 PnP)
```

If contributing to core features that depend on `@langchain/core`, ensure it is built first when making local changes:

```bash
cd langchain-core
yarn
yarn build
```

### Common Root Scripts (`package.json`)

```bash
yarn build                     # turbo build (skips test-exports-* workspaces)
yarn clean                     # turbo clean across workspaces
yarn format                    # run Prettier formatting
yarn lint:fix                  # run ESLint with --fix
yarn test                      # unit tests + export environment tests via docker
yarn test:unit                 # unit tests (filters out examples/docs/export tests)
yarn test:int                  # spin up deps, run integration tests, tear down
yarn test:exports:docker       # environment/export tests across JS runtimes
yarn test:ranges:docker        # dependency range tests
yarn docs                      # start core_docs site
yarn docs:api_refs             # start api_refs site
yarn example                   # run examples workspace start script
```

### Turborepo Task Graph Highlights (`turbo.json`)

- `build` depends on upstream package `^build` tasks; outputs cached `dist/**`.
- Testing tasks depend on `build` to ensure artifacts are compiled.
- `test` task caching disabled (`"cache": false`).

### Testing

- Unit tests: `yarn test:unit` (Jest) — add `*.test.ts` alongside source.
- Integration tests: `*.int.test.ts`; run selectively with `yarn test:int` (spins Docker services) or single test via workspace-level scripts (see CONTRIBUTING guidance for `yarn test:single`).
- Environment/export tests: `yarn test:exports:docker` (validates multi-env compatibility & export shapes).
- Dependency range tests: `yarn test:ranges:docker`.

### Examples

Add example under `examples/src/...` and invoke via root `yarn example path/to/example` (path relative to `examples/src`). Add required environment variables to `examples/.env` when needed.

### Documentation

- Generate/start docs: `yarn docs` (after `yarn`).
- API refs: `yarn docs:api_refs`.
- Notebook-based docs use Deno import conventions (`deno.json` governs import maps). Update import map when adding new runtime dependencies to notebooks.

### Adding Entrypoints

Modify `langchain/langchain.config.js` (or corresponding package config) adding the new key under `entrypoints`. If it requires an optional third-party dependency, also add its path to `requiresOptionalDependency`.

## Coding Guidelines

- Maintain consistency with Python LangChain abstractions when possible; open an issue before introducing new abstractions.
- Place integrations in `libs/langchain-community` unless a dedicated package is justified.
- Provide tests (unit for pure logic; integration for external API calls) when adding features.
- Provide TypeDoc-friendly JSDoc comments for public classes/methods to ensure documentation generation quality.
- Keep formatting (`yarn format`) and lint (`yarn lint`) clean before submitting PRs.

## Pull Request Guidelines

- Use fork & pull request workflow; do not push directly unless maintainer (per `CONTRIBUTING.md`).
- Assign yourself to issues you are implementing; keep issues focused on a single bug/feature.
- For new abstractions or sizable design changes: open an issue first for discussion.
- Include/extend tests relevant to changes (unit or integration). Provide environment variable setup guidance if adding integration tests.
- Add or update documentation & examples where helpful (especially for new integrations or major features).
- Ensure lint, format, build, and tests pass locally before submission.

## Security Considerations

- Report vulnerabilities to: `security@langchain.dev` (per `SECURITY.md`).
- Do not disclose security issues publicly before coordinated response.

## Debugging & Troubleshooting

- Build issues: Ensure `langchain-core` rebuilt if changing its exports before using dependent packages.
- Missing integration imports: Confirm entrypoint added to `langchain.config.js` and (if optional) listed in `requiresOptionalDependency`.
- Export/interop failures: Run `yarn test:exports:docker` to validate ESM/CJS and edge environment compatibility.
- Failing integration tests: Verify required env vars (.env in relevant workspace) and that `test:int:deps` services are running.

## Adding New Integrations (Key Points)

- Place in `libs/langchain-community` or create a new `libs/<package>` if scope warrants.
- Scaffold via `npx create-langchain-integration` (utility referenced in `CONTRIBUTING.md`).
- After adding new integration package, update CI workflow (`unit-tests-integrations.yml`) `PACKAGES` env (manual step described).
- Provide at least one integration test (`*.int.test.ts`) and relevant docs/examples.

## Environment & Platform Support

- Target runtimes: Node.js (CJS + ESM), Edge (Cloudflare Workers, Vercel Edge, Supabase Edge), Browser, Deno.
- Ensure code avoids Node-only APIs unless guarded or documented; rely on abstractions in `@langchain/core` when possible.

## Contact & Community

- Issues: Bug reports & doc improvements on GitHub Issues; feature discussions primarily on LangChain Forum.
- Forum: https://forum.langchain.com
