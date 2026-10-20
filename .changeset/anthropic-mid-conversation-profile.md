---
"@langchain/anthropic": patch
---

feat(anthropic): declare mid-conversation support in model profiles. Claude Opus 4.8, Opus 5, Opus 5.5, Sonnet 5.5, Haiku 5.5, Fable 5 and 5.1, and Mythos 5 and 5.1 set `midConversationSystemMessages` and `midConversationTools`. Sonnet 5 sets system messages only.

Regenerating the profiles from models.dev also adds Claude Opus 5.5, Sonnet 5.5 and Haiku 5.5, removes Claude Opus 4.1, and lowers Claude Sonnet 4.5's `maxInputTokens` to 200,000.
