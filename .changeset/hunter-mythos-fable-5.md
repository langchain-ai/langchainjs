---
"@langchain/anthropic": patch
---

feat(anthropic): add support for claude-fable-5 and claude-mythos-5 models

- upgrade `@anthropic-ai/sdk` to `^0.103.0`
- add default token handling and adaptive-thinking parameter compatibility for Anthropic 5-series models
- add unit and integration coverage for default-parameter behavior on new model IDs
