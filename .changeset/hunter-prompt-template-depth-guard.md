---
"@langchain/core": patch
---

fix(prompts): enforce maximum prompt template nesting depth

Add recursion depth guards for mustache template parsing and dict prompt template traversal to prevent stack-exhaustion DoS from deeply nested attacker-controlled templates.
