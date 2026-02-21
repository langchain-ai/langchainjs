---
"@langchain/anthropic": patch
"@langchain/community": patch
"@langchain/aws": patch
"langchain": patch
---

fix: replace retired Anthropic model IDs with active replacements

- Update default model in ChatAnthropic from `claude-3-5-sonnet-latest` to `claude-sonnet-4-5-20250929`
- Regenerate model profiles with latest data from models.dev API
- Replace retired `claude-3-5-haiku-20241022`, `claude-3-7-sonnet-20250219`, `claude-3-5-sonnet-20240620`, and `claude-3-5-sonnet-20241022` in tests, docstrings, and examples
