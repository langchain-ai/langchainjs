---
"@langchain/google": patch
---

fix(google): accept both uppercase and lowercase reasoning effort/thinking level values

Previously, passing uppercase values like `reasoningEffort: "HIGH"` or `"MEDIUM"` would silently
fail to configure thinking, because `convertReasoningEffortToReasoningTokens` only matched lowercase
strings. This caused the `thinkingConfig` to be omitted entirely from the API request.

- Normalize effort input to lowercase in `convertReasoningEffortToReasoningTokens`
- Extend `Gemini.ThinkingLevel` type to include lowercase variants for better DX
- Add `LowercaseLiteral` utility type to derive lowercase members from the auto-generated API types
