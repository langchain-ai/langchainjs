---
"@langchain/core": patch
"@langchain/google": patch
"@langchain/anthropic": patch
"@langchain/openai": patch
---

feat(core): add namespace-based symbol branding for error class hierarchies

Introduces `createNamespace` utility for hierarchical symbol-based branding of class hierarchies.
All LangChain error classes now use this pattern, replacing hand-rolled duck-type `isInstance` checks
with reliable cross-realm `Symbol.for`-based identity.

- New `LangChainError` base class that all LangChain errors extend
- New `createNamespace` / `Namespace` API in `@langchain/core/utils/namespace`
- Refactored `ModelAbortError`, `ContextOverflowError` to use namespace branding
- Added `ContextOverflowError.fromError()` static factory method
- Deprecated `addLangChainErrorFields` in favor of `LangChainError` subclasses
- Migrated Google provider errors (`GoogleError`, `ConfigurationError`, etc.) to namespace branding
- Updated Anthropic and OpenAI providers to use `ContextOverflowError.fromError()`
