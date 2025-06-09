# LangChain Build System

A modern build system for LangChain JavaScript/TypeScript packages that provides fast compilation, type checking, and automated secret management for monorepo workspaces.

## Overview

This build system is designed to handle the complex requirements of LangChain's multi-package monorepo. It automatically discovers packages in the workspace, compiles them with optimal settings, and includes specialized tooling for LangChain's security patterns.

### Key Features

- 🚀 **Fast Compilation**: Uses [tsdown](https://github.com/privatenumber/tsdown) for high-performance TypeScript bundling
- 📦 **Monorepo Aware**: Automatically discovers and builds all non-private packages in yarn workspaces
- 🔍 **Secret Management**: Built-in scanning and validation of LangChain's `lc_secrets` patterns
- 📝 **Type Generation**: Generates both ESM and CommonJS outputs with TypeScript declarations
- ✅ **Quality Checks**: Integrated type checking with [arethetypeswrong](https://github.com/arethetypeswrong/arethetypeswrong) and [publint](https://github.com/bluwy/publint)
- 🎯 **Selective Building**: Build all packages or target specific ones

## Architecture

The build system consists of:

```
infra/build/
├── index.ts              # Main build orchestrator
├── plugins/
│   ├── README.md         # Plugin documentation
│   └── lc-secrets.ts     # LangChain secrets scanning plugin
├── package.json          # Build system dependencies
└── README.md             # This documentation
```

### Core Technologies

- **[tsdown](https://github.com/privatenumber/tsdown)** - Fast TypeScript bundler with Rolldown
- **[TypeScript Compiler API](https://github.com/microsoft/TypeScript)** - For source code analysis and type checking
- **[yarn workspaces](https://yarnpkg.com/features/workspaces)** - For monorepo package discovery
- **Node.js built-ins** - File system operations and process management

## Usage

### Basic Commands

```bash
# Build all packages in the workspace
npx turbo build:new

# Build specific package by name
npx turbo build:new --filter langchain-core

# Build packages matching a pattern
npx turbo build:new --filter "*openai*"

# Build multiple specific packages
npx turbo build:new --filter langchain-core --filter langchain-openai
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode (`development`/`production`) | `development` |
| `SKIP_SECRET_SCANNING` | Disable secret scanning entirely | `false` |

### Examples

```bash
# Development build (lenient secret validation)
NODE_ENV=development npx turbo build:new

# Production build (strict secret validation)
NODE_ENV=production npx turbo build:new

# Build without secret scanning
SKIP_SECRET_SCANNING=true npx turbo build:new

# Build specific packages
npx turbo build:new --filter langchain-openai
npx turbo build:new --filter "*community*"

# Build packages in parallel with custom concurrency
npx turbo build:new --concurrency 4
```

## Development

### Adding New Packages

1. Create package directory under appropriate workspace
2. Add `package.json` with proper exports field
3. Add `tsconfig.json` extending workspace config
4. Run build - it will be automatically discovered

### package.json Requirements

Each package must have a properly configured `exports` field that includes an `input` property to tell the build system which source file to compile for each entrypoint:

```json
{
  "name": "@langchain/example",
  "exports": {
    ".": {
      "input": "./src/index.ts",       // ← Required: Source file for this entrypoint
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    },
    "./tools": {
      "input": "./src/tools/index.ts", // ← Required: Source file for tools entrypoint
      "import": "./dist/tools/index.js",
      "require": "./dist/tools/index.cjs",
      "types": "./dist/tools/index.d.ts"
    }
  }
}
```

**Important**: The `input` property is required for the build system to understand which TypeScript source file should be compiled for each export. Without this property, the entrypoint will be ignored during build.

### Turbo Configuration

The build system integrates with Turbo for optimal caching and parallelization. Ensure your `turbo.json` includes:

```json
{
  "tasks": {
    "build:new": {
      "dependsOn": ["^build:new"],
      "outputs": ["dist/**"]
    }
  }
}
```