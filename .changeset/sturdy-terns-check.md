---
"@langchain/anthropic": patch
---

Fix type errors where `@langchain/anthropic` had drifted from `@anthropic-ai/sdk`'s types

The `webSearch_20250305` tool's `userLocation` option is typed as
`Anthropic.Beta.BetaUserLocation`, since the SDK no longer exports the
`BetaWebSearchTool20250305.UserLocation` alias it used (same shape). Tool
extras type `input_examples` and `allowed_callers` with the SDK's element
types instead of `unknown`, so formatted tools match `ToolUnion`; validation is
unchanged. The stream chunk converter accepts GA as well as beta stream events,
since a request goes to either endpoint depending on its betas.

No behaviour change.
