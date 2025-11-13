# Environment Tests

This directory contains tests that verify LangChain packages work correctly in different JavaScript/TypeScript environments.

## Overview

The environment tests create isolated Docker containers that mimic real user environments, ensuring our packages work correctly with:

- Different module systems (ESM, CJS)
- Different bundlers (esbuild, Vite, Webpack via Next.js)
- Different runtimes (Node.js, Bun, Cloudflare Workers)
- TypeScript compilation

## Architecture

### Test Runner (`scripts/test-runner.ts`)

The TypeScript test runner:

1. Creates a sandbox environment at `/app` in the Docker container
2. Copies the test package files (excluding build artifacts)
3. Sets up workspace packages by:
   - Copying available local packages to `/app/libs/`
   - Replacing `workspace:*` dependencies with published versions for unavailable packages
4. Runs `pnpm install --prod` to install dependencies
5. Executes the build and test commands

### Docker Setup

Each test environment runs in its own Docker container with:

- The test package mounted at `/package`
- Workspace packages mounted at their respective paths
- The test runner script mounted at `/scripts`
- A clean `/app` directory as the test sandbox

### Test Environments

- **test-exports-esm**: Tests ESM imports and exports
- **test-exports-cjs**: Tests CommonJS require/exports
- **test-exports-esbuild**: Tests bundling with esbuild
- **test-exports-tsc**: Tests TypeScript compilation
- **test-exports-cf**: Tests Cloudflare Workers compatibility
- **test-exports-vercel**: Tests Next.js/Vercel compatibility
- **test-exports-vite**: Tests Vite bundling
- **test-exports-bun**: Tests Bun runtime compatibility

## Running Tests

```bash
docker compose -f environment_tests/docker-compose.yml run <environment>
# e.g. for test-exports-esbuild
docker compose -f environment_tests/docker-compose.yml run test-exports-esbuild
```

## Adding New Tests

1. Create a new directory `test-exports-{name}/`
2. Add a `package.json` with:
   - Dependencies using `workspace:*` for local packages
   - A `build` script (if needed)
   - A `test` script that runs your tests
3. Add test files in `src/`
4. Add the service to `docker-compose.yml`:
   ```yaml
   test-exports-{name}:
     image: node:20
     environment:
       PUPPETEER_SKIP_DOWNLOAD: "true"
       PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "true"
     working_dir: /app
     volumes:
       - ../pnpm-workspace.yaml:/pnpm-workspace.yaml
       - ../turbo.json:/turbo.json
       - ../environment_tests/test-exports-{name}:/package
       - ../environment_tests/scripts:/scripts
       - ../langchain:/langchain
       - ../langchain-core:/langchain-core
       # ... other packages
     command: bash /scripts/docker-entrypoint.sh
   ```

## How It Works

1. Docker mounts the test package and workspace packages into the container
2. The entrypoint script installs `tsx` (or uses Bun directly) and runs the test runner
3. The test runner:
   - Creates a clean sandbox environment
   - Copies and prepares packages with proper dependency resolution
   - Runs the test package's build and test scripts
4. Tests verify that imports, exports, and functionality work as expected

This approach ensures we test against real package installations, not source code, providing confidence that our published packages work correctly in user environments.
