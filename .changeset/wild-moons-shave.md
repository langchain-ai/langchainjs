---
"@langchain/fireworks": patch
"@langchain/together-ai": patch
---

Restore the `configuration` option on the input types

`configuration` moved from `OpenAIChatInput` to `BaseChatOpenAIFields` in
`@langchain/openai`, so these packages' input interfaces lost the field while
their constructors still read `fields.configuration`. It is now picked up from
the interface that owns it.

`ChatTogetherAI.lc_aliases` is now typed `Record<string, string>`, matching
the `@langchain/openai` class it overrides.
