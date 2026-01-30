---
"@langchain/xai": minor
---

feat(xai): add server-side agentic tools and deprecate live_search

Added new xAI server-side agentic tools for the Responses API:

- `xaiWebSearch()`: Web search with domain filtering and image understanding
- `xaiXSearch()`: X (Twitter) search with handle filtering, date ranges, and media understanding
- `xaiCodeExecution()`: Python code execution for calculations and analysis
- `xaiCollectionsSearch()`: Search through uploaded knowledge bases (vector stores)

Also:
- Deprecated `xaiLiveSearch()` with migration guidance to new tools
- Added `tools` support to `ChatXAIResponses` constructor and call options
- Updated `XAIResponsesWebSearchTool` type with correct filtering options
