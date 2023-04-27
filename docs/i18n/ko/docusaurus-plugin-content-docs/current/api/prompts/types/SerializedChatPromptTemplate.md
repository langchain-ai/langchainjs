---
title: "SerializedChatPromptTemplate"
---

# SerializedChatPromptTemplate

> **SerializedChatPromptTemplate**: `object`

Serialized Chat prompt template

## Type declaration

| Member             | Type                                                                      |
| :----------------- | :------------------------------------------------------------------------ |
| `input_variables`  | `string`[]                                                                |
| `prompt_messages`  | [`SerializedMessagePromptTemplate`](SerializedMessagePromptTemplate.md)[] |
| `_type`?           | "chat_prompt"                                                             |
| `template_format`? | [`TemplateFormat`](TemplateFormat.md)                                     |

## Defined in

[langchain/src/prompts/serde.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/serde.ts#L29)
