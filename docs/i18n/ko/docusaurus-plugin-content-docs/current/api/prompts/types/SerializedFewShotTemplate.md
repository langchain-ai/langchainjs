---
title: "SerializedFewShotTemplate"
---

# SerializedFewShotTemplate

> **SerializedFewShotTemplate**: `object`

## Type declaration

| Member              | Type                                                      |
| :------------------ | :-------------------------------------------------------- |
| `_type`             | "few_shot"                                                |
| `example_separator` | `string`                                                  |
| `examples`          | `string` \| [`Example`](../../schema/types/Example.md)[]  |
| `input_variables`   | `string`[]                                                |
| `template_format`   | [`TemplateFormat`](TemplateFormat.md)                     |
| `example_prompt`?   | [`SerializedPromptTemplate`](SerializedPromptTemplate.md) |
| `prefix`?           | `string`                                                  |
| `suffix`?           | `string`                                                  |

## Defined in

[langchain/src/prompts/serde.ts:11](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/serde.ts#L11)
