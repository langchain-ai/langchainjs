---
"@langchain/core": patch
"@langchain/openai": patch
---

Keep streamed Chat Completions refusals (`delta.refusal`): the native stream converter now emits a `refusal` content block, and the legacy delta converter carries refusal deltas in `additional_kwargs`, so `withStructuredOutput` streaming raises `ModelRefusalError` instead of a parse error.
