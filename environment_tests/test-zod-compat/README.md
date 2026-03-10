# Zod Compatibility Tests

Regression tests for the zod version mismatch OOM bug.

These tests verify that `@langchain/core`'s exported types work correctly
when consumers install different zod versions than what core was built with.

## Test Scenarios

| Test | Consumer zod | Core built with | What it tests |
|------|-------------|-----------------|---------------|
| `zod-v3` | `~3.25.76` | `4.x` | Consumers using zod v3 can type-check against core |
| `zod-v4` | `^4` | `4.x` | Happy path — same major version |
| `zod-mismatch` | `~3.25.76` | `4.x` | The critical OOM regression test — different zod copies |

## Running

```bash
# From monorepo root:
bash environment_tests/test-zod-compat/run.sh
```

The script:
1. Builds `@langchain/core`
2. Packs it as a tarball
3. For each test: creates a temp directory, installs the tarball + zod + typescript
4. Runs `tsc --noEmit` with a 60s timeout and 512MB heap limit
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
