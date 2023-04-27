---
title: "loadAgent()"
---

# loadAgent()

> **loadAgent**(`uri`: `string`, `llmAndTools`?: `object`): `Promise`<[`Agent`](../../agents/classes/Agent.md)\>

## Parameters

| Parameter            | Type                                                                    |
| :------------------- | :---------------------------------------------------------------------- |
| `uri`                | `string`                                                                |
| `llmAndTools?`       | `object`                                                                |
| `llmAndTools.llm?`   | [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md) |
| `llmAndTools.tools?` | [`Tool`](../../tools/classes/Tool.md)[]                                 |

## Returns

`Promise`<[`Agent`](../../agents/classes/Agent.md)\>

## Defined in

[langchain/src/agents/load.ts:17](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/load.ts#L17)
