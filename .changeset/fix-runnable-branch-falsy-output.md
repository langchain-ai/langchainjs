---
"@langchain/core": patch
---

fix(core): return a matched `RunnableBranch` branch's falsy output instead of falling through to the default branch

`RunnableBranch._invoke` selected the default branch with `if (!result)`, keyed on the output of the matched branch rather than on whether any condition matched. A branch returning `0`, `""`, `false`, `null`, `NaN` or `undefined` was therefore discarded and the default branch ran in its place — silently, with the default's own callbacks firing. `.invoke()` and `.batch()` were affected; `.stream()` was not, because `_streamIterator` already keys its default on a sentinel (`stream === undefined`).

The matching branch's result is now returned directly, so the default is reached only when no condition matched — the same rule `RunnableBranch.invoke` follows in Python (a `for`/`else`), and one with no sentinel left for a falsy output to satisfy.
