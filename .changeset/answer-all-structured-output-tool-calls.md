---
"langchain": patch
---

fix(langchain): answer every tool call when the model returns multiple structured outputs

When a `ToolStrategy` response format is used and the model emits more than one structured-output tool call in a single turn, `AgentNode` answered only the first call and left the rest unanswered. The retry request was therefore missing tool results for those calls, which providers reject (e.g. OpenAI `400 INVALID_TOOL_RESULTS`), after which the agent could loop until the recursion limit. The retry now emits a `ToolMessage` for every tool call in the response, so the message sequence is valid and the agent retries as intended.
