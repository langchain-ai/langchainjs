---
"@langchain/google-common": patch
---

Fix type errors where `@langchain/google-common` had drifted from core v1

The Anthropic converter now names the data content block types through core's
`Data` namespace, where core v1 moved them; those imports were type-only, so
neither the JavaScript nor the published declarations referenced them. It
types the content it builds as core's `ContentBlock`s, copying each Anthropic
text and thinking block into a plain object first. The Google Search output
parsers read the grounding fields through a typed view of `response_metadata`,
and `reasoningLevel` maps to a `GoogleThinkingLevel`.

Valid responses convert exactly as before. A `text` block whose `text` is not a
string now counts as empty text in the Google Search output parsers, and makes
the Anthropic `chunkToString` throw `Unexpected chunk` instead of returning a
non-string.
