---
"@langchain/classic": patch
---

Throw a clear error when `LLMChain.serialize()` cannot serialize its prompt

Core v1 removed `serialize()` from `BasePromptTemplate`, so the deprecated
`LLMChain.serialize()` threw `this.prompt.serialize is not a function` for
prompts such as `ChatPromptTemplate`. It now throws
`LLMChain cannot serialize a "<type>" prompt. Use .toJSON() instead.`
Prompts that can still serialize themselves, such as `PromptTemplate` and
`FewShotPromptTemplate`, serialize as before. `LLMChain.deserialize()` reads
`prompt` and `few_shot` prompts with those classes, as core's removed
`BasePromptTemplate.deserialize()` did.
