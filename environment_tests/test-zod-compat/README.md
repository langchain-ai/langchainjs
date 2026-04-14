# Zod Compatibility Tests

Regression tests for the zod version mismatch OOM bug (TS2589).

These tests verify that `@langchain/core` and `langchain` exported types
work correctly when consumers install different zod versions than what
the packages were built with.

## Test Scenarios

| Test           | Consumer zod                                                 | What it tests                                                |
| -------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `zod-v3`       | `~3.25.76`                                                   | Core types + agent APIs with zod v3                          |
| `zod-v4`       | `^4`                                                         | Core types + agent APIs with zod v4                          |
| `zod-mismatch` | `~3.25.76` (top-level) + `4.3.6` (nested in @langchain/core) | OOM regression — two different zod copies in the module tree |

## What's tested

Each test simulates a real consumer app using `@langchain/core` and `langchain`:

- `tool()` with simple, nested, enum, and deeply-nested zod schemas
- `StructuredOutputParser.fromZodSchema()`
- `createMiddleware()` with `stateSchema` and `beforeAgent`/`beforeModel` hooks
- `createAgent()` — basic, with middleware, with `responseFormat`, with `stateSchema`, kitchen sink
- `toolStrategy()` and `providerStrategy()` with zod schemas

No internal type utilities are imported — only public consumer-facing APIs.
On `main` (before the fix), `zod-mismatch` will OOM. On this branch it passes.

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

The `zod-v3` and `zod-v4` tests are straightforward: install one version
of zod at the top level and type-check against it.

The `zod-mismatch` test is different. After the normal npm install, the
run script forces a **different** zod version into a nested `node_modules`
inside `@langchain/core`:

```
node_modules/
  zod/                          <-- 3.25.76 (consumer's top-level copy)
  @langchain/core/
    node_modules/
      zod/                      <-- 4.3.6 (different copy, nested)
```

This means TypeScript resolves **two distinct copies** of zod's `.d.ts`
files. When `@langchain/core`'s internal `.d.ts` files `import` from `zod`,
TypeScript follows the Node module resolution and finds the nested v4 copy.
When the consumer's code `import`s from `zod`, it finds the top-level v3 copy.

If `@langchain/core`'s **exported** types referenced real zod types
(`z3.ZodType`, `z4.$ZodType`), TypeScript would need to check whether the
consumer's v3 zod type is assignable to core's v4 zod type (or vice versa).
Since the two copies are nominally different, TypeScript falls back to a full
structural comparison of ~3,400+ lines of mutually-recursive generics — OOM.

With the structural duck-type fix, `@langchain/core`'s exported `.d.ts`
files don't `import` from `zod` at all. The exported types are lightweight
interfaces (`ZodV3Like`, `ZodV4Like`, etc.) defined inline, so there is
nothing for TypeScript to structurally compare across the two copies.
