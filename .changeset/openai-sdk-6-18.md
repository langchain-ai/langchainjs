---
"@langchain/openai": patch
---

feat(openai): update openai SDK to ^6.18.0

- Adds support for codex 5.3
- Added `action` option to image generation tool (`generate`, `edit`, `auto`)
- Removed `@ts-expect-error` for `gpt-image-1.5` model (now in SDK types)
- Auto-route codex models (`codex-mini-latest`, `gpt-5-codex`, `gpt-5.1-codex`, etc.) to Responses API
- Added `shell_call` and `local_shell_call` to streaming converter and input reconstruction
- Added unit tests for `isReasoningModel` and `_modelPrefersResponsesAPI`
