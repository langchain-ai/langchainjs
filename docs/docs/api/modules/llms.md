---
id: "llms"
title: "Module: llms"
sidebar_label: "llms"
sidebar_position: 0
custom_edit_url: null
---

## Classes

- [BaseLLM](../classes/llms.BaseLLM.md)
- [LLM](../classes/llms.LLM.md)

## References

### OpenAI

Re-exports [OpenAI](../classes/.OpenAI)

## Type Aliases

### Generation

Ƭ **Generation**: `Object`

Output of a single generation.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `generationInfo?` | `Record`<`string`, `any`\> | Raw generation info response from the provider. May include things like reason for finishing (e.g. in [OpenAI](llms.md#openai)) |
| `text` | `string` | Generated text output |

#### Defined in

[llms/index.ts:18](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/llms/index.ts#L18)

___

### LLMCallbackManager

Ƭ **LLMCallbackManager**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `handleEnd` | (`output`: [`LLMResult`](llms.md#llmresult), `verbose?`: `boolean`) => `void` |
| `handleError` | (`err`: `string`, `verbose?`: `boolean`) => `void` |
| `handleStart` | (`llm`: { `name`: `string`  }, `prompts`: `string`[], `verbose?`: `boolean`) => `void` |

#### Defined in

[llms/index.ts:5](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/llms/index.ts#L5)

___

### LLMResult

Ƭ **LLMResult**: `Object`

Contains all relevant information returned by an LLM.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `generations` | [`Generation`](llms.md#generation)[][] | List of the things generated. Each input could have multiple [generations](llms.md#generation), hence this is a list of lists. |
| `llmOutput?` | `Record`<`string`, `any`\> | Dictionary of arbitrary LLM-provider specific output. |

#### Defined in

[llms/index.ts:34](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/llms/index.ts#L34)

___

### SerializedLLM

Ƭ **SerializedLLM**: { `_type`: `string`  } & `Record`<`string`, `any`\>

#### Defined in

[llms/base.ts:20](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/llms/base.ts#L20)

## Functions

### loadLLM

▸ **loadLLM**(`file`): `Promise`<[`BaseLLM`](../classes/llms.BaseLLM.md)\>

Load an LLM from a local file.

**`Example`**

```ts
import { loadLLM } from "langchain/llms";
const model = await loadLLM("/path/to/llm.json");
```

#### Parameters

| Name | Type |
| :------ | :------ |
| `file` | `string` |

#### Returns

`Promise`<[`BaseLLM`](../classes/llms.BaseLLM.md)\>

#### Defined in

[llms/load.ts:13](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/llms/load.ts#L13)
