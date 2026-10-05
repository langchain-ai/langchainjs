---
"@langchain/classic": patch
---

Keep the tool name on OpenAI functions agent scratchpad messages

`formatToOpenAIFunctionMessages` and the `OpenAIAgent` scratchpad built each
tool result with `new FunctionMessage(observation, toolName)`. Core v1's
`FunctionMessage` takes a single fields object and ignores a second argument,
so every function message had no `name`, and the next model call sent
OpenAI a `function` message without the name it requires. They now pass
`{ content, name }`.
