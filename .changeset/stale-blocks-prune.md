---
"@langchain/aws": patch
---

Remove dead content block checks from the v1 Bedrock Converse message converter

`convertFromV1ToChatBedrockConverseMessage` skipped `web_search_call`,
`web_search_result`, `code_interpreter_call` and `code_interpreter_result`
blocks, types that `@langchain/core` replaced with `server_tool_call` and
`server_tool_call_result` before 1.0. Those checks are removed. A block with one
of these types is still skipped, like any block type the converter does not
handle, so no behaviour changes. `ChatBedrockConverse` now implements
`ChatBedrockConverseInput` without `profile`, the AWS credentials profile name,
which clashes with the model `profile` getter the class inherits from
`BaseChatModel`. Neither the input type nor the class's own type changes.
