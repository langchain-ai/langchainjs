---
"@langchain/core": patch
"langchain": patch
---

fix: add explicit `: symbol` type annotations to Symbol.for() declarations for cross-version compatibility

TypeScript infers `unique symbol` type when Symbol.for() is used without an explicit type annotation, causing type incompatibility when multiple versions of the same package are present in a dependency tree. By adding explicit `: symbol` annotations, all declarations now use the general symbol type, making them compatible across versions while maintaining identical runtime behavior.

Changes:
- Added `: symbol` to `MESSAGE_SYMBOL` in messages/base.ts
- Added `: symbol` to `MIDDLEWARE_BRAND` in agents/middleware/types.ts (also changed from Symbol() to Symbol.for() for cross-realm compatibility)
