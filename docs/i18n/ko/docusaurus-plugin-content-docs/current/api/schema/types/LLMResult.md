---
title: "LLMResult"
---

# LLMResult

> **LLMResult**: `object`

Contains all relevant information returned by an LLM.

## Type declaration

| Member        | Type                                            | Description                                                                                                                             |
| :------------ | :---------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| `generations` | [`Generation`](../interfaces/Generation.md)[][] | List of the things generated. Each input could have multiple [generations](../interfaces/Generation.md), hence this is a list of lists. |
| `__run`?      | `Record`<`string`, `any`\>                     | Dictionary of run metadata                                                                                                              |
| `llmOutput`?  | `Record`<`string`, `any`\>                     | Dictionary of arbitrary LLM-provider specific output.                                                                                   |

## Defined in

[langchain/src/schema/index.ts:34](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/index.ts#L34)
