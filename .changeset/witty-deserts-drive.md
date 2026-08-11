---
"@langchain/core": patch
"langchain": patch
---

fix: apply [Symbol.hasInstance] method to all comparable properties using .isInstance()

We have some internal schemas that rely on `z.instanceof()`. This uses a strict `instanceof` check which can conflict if there are multiple versions of core installed. This overrides the [Symbol.hasInstance](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/hasInstance) method to use the same logic as `.isInstance()` to compare objects at runtime.
