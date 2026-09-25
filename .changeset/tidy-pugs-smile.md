---
"@langchain/openai": patch
---

fix(openai): forward string `tool_choice` values on the Responses API

`"none"`, `"auto"` and `"required"` were dropped when building a Responses
request, so `tool_choice: "required"` did not force a tool call and
`tool_choice: "none"` did not prevent one — both silently fell back to the
provider default. These are valid `ToolChoiceOptions` values and are now sent
unchanged; only the named-function shape still needs converting.
