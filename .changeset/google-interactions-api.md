---
"@langchain/google": patch
---

Adds **experimental** support for the Google Interactions API on AI Studio and
Google Cloud (Vertex).

- Add `InteractionsApiHandler` (`apiHandler: "interactions"`) supporting `.invoke()`, `.stream()`, and `.streamEvents()` across AI Studio (`gai`) and Vertex AI (`gcp`)
- Add Interactions API converters for messages, tools, parameters, and streaming SSE events
- Generate Interactions API TypeScript types from the OpenAPI specification (`src/chat_models/api_types/interactions.ts`)
- Export `GoogleChatApiHandler`, `GenerateContentApiHandler`, `InteractionsApiHandler`, and Interactions converters
- Supports backwards compatibility with the current API.
- Parameters for the Integrations API are exposed, but no specific feature changes are included.
