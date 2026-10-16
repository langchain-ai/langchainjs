---
"@langchain/google": patch
---

refactoring in preparation for Interactions API
  - Protocol-specific operations are now done through `GoogleChatApiHandler`
    subclass
  - Converters for generate_content and shared converters
  - Types moved into protocol-specific generated file
- Includes support Gemini 4 Argon parity (thinking config, model profile,
  usage-only streaming)
