---
"@langchain/build": minor
"@langchain/community": patch
---

## Dual Build Capability in LangChain.js

LangChain.js implements a sophisticated dual build system using `tsdown` that produces both CommonJS (CJS) and EcmaScript Module (ESM) builds simultaneously. This enables seamless usage across different JavaScript environments and module systems.

### Key Features of the Dual Build System:

- **Dual Format Output**: Generates both `.js` (ESM) and `.cjs` (CommonJS) files
- **Type Declarations**: Produces corresponding `.d.ts` (ESM) and `.d.cts` (CommonJS) declaration files  
- **Standardized Configuration**: Uses `@langchain/build` package's `getBuildConfig()` function for consistent builds across all packages
- **Export Maps**: Implements conditional exports in package.json to properly route imports to the correct format
- **Source Maps**: Includes source map files for debugging in both formats
- **Validation**: Integrates ATTW (Are The Types Wrong), publint, and unused export checking for quality assurance

### How It Works:

The build system leverages the `@langchain/build` package which provides a standardized `getBuildConfig()` function. This function sets up `tsdown` with:
- `format: ["cjs", "esm"]` to generate both module formats
- Platform-specific configurations for Node.js environments
- Plugin system for handling special cases like CJS compatibility and secret handling
- Conditional exports mapping to ensure proper resolution in different environments

This dual build approach ensures LangChain.js packages work seamlessly in both traditional Node.js CommonJS environments and modern ESM environments, without requiring users to worry about module compatibility issues.