---
"@langchain/core": patch
---

fix(core): replace exported zod type references with structural duck-type interfaces to fix TypeScript OOM

Replaces all exported Zod type references (`z3.ZodType`, `z4.$ZodType`, etc.) in `@langchain/core`'s public API with minimal structural ("duck-type") interfaces. This prevents TypeScript from performing expensive deep structural comparisons (~3,400+ lines of mutually recursive generics) when downstream packages resolve a different Zod version than `@langchain/core`, which was causing OOM crashes and unresponsive language servers in monorepo setups.
