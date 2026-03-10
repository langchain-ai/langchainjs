# Zod Compatibility Tests

Regression tests for the zod version mismatch OOM bug (TS2589).

These tests verify that `@langchain/core` and `langchain` exported types
work correctly when consumers install different zod versions than what
the packages were built with.

## Test Scenarios

| Test | Consumer zod | What it tests |
|------|-------------|---------------|
| `zod-v3` | `~3.25.76` | Core types + agent APIs with zod v3 |
| `zod-v4` | `^4` | Core types + agent APIs with zod v4 |
| `zod-mismatch` | `~3.25.76` | OOM regression — consumer has v3, packages built with v4 |

## What's tested

Each test exercises both `@langchain/core` primitives and `langchain` agent APIs:

**Core types:**
- `tool()` with simple, nested, enum, string, and deeply-nested schemas
- `StructuredOutputParser.fromZodSchema()`
- `InteropZodType` assignability for all primitive and composite types
- `InferInteropZodOutput` type inference
- `ZodV3Like`/`ZodV4Like`/`ZodV3ObjectLike`/`ZodV4ObjectLike` assignability

**Agent APIs:**
- `createMiddleware()` with `stateSchema` and `beforeAgent`/`beforeModel` hooks
- `createAgent()` — basic, with middleware, with `responseFormat`, with `stateSchema`, kitchen sink
- `toolStrategy()` and `providerStrategy()` with zod schemas

## Running

```bash
# From monorepo root:
bash environment_tests/test-zod-compat/run.sh
```

The script:
1. Builds `langchain` (which also builds `@langchain/core`)
2. Packs both as tarballs
3. For each test: creates an isolated temp directory, installs both tarballs + zod + typescript
4. Runs `tsc --noEmit` with a 120s timeout and 512MB heap limit
5. Reports pass/fail

## How the mismatch test works

When `@langchain/core` is installed from a tarball (simulating npm install),
its `.d.ts` files are fixed at build time. The consumer's `node_modules/zod`
resolves to a *different* version. If `@langchain/core`'s types directly
referenced `z3.ZodType` or `z4.$ZodType`, TypeScript would attempt a deep
structural comparison of ~3,400+ lines of mutually-recursive generics → OOM.

With the structural duck-type fix, `@langchain/core` exports minimal
interfaces (`ZodV3Like`, `ZodV4Like`, etc.) that don't import from zod,
so no deep comparison is needed.
