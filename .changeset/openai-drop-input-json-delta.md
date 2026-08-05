---
"@langchain/openai": patch
---

Drop `input_json_delta` streaming-artifact content blocks when converting
messages to Chat Completions params. Anthropic streaming can leave
`input_json_delta` blocks in `AIMessage.content`, including after the message is
checkpointed and restored; these were passed through raw and rejected by OpenAI
with `400 Invalid value: 'input_json_delta'` — e.g. when a message authored by a
Claude model is replayed to an OpenAI model. For finalized messages the
consolidated tool call is already present in `message.tool_calls`, so dropping
the residual delta does not lose tool-call information.
