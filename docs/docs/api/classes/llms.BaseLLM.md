---
id: "llms.BaseLLM"
title: "Class: BaseLLM"
sidebar_label: "BaseLLM"
custom_edit_url: null
---

[llms](../modules/llms.md).BaseLLM

LLM Wrapper. Provides an [call](llms.BaseLLM.md#call) (an [generate](llms.BaseLLM.md#generate)) function that takes in a prompt (or prompts) and returns a string.

## Hierarchy

- **`BaseLLM`**

  ↳ [`OpenAI`](.OpenAI)

  ↳ [`LLM`](llms.LLM.md)

## Constructors

### constructor

• **new BaseLLM**(`callbackManager?`, `verbose?`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `callbackManager?` | [`LLMCallbackManager`](../modules/llms.md#llmcallbackmanager) |
| `verbose?` | `boolean` |

#### Defined in

[llms/base.ts:43](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/base.ts#L43)

## Properties

### cache

• `Optional` **cache**: `boolean`

#### Defined in

[llms/base.ts:34](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/base.ts#L34)

___

### callbackManager

• **callbackManager**: [`LLMCallbackManager`](../modules/llms.md#llmcallbackmanager)

#### Defined in

[llms/base.ts:36](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/base.ts#L36)

___

### name

• **name**: `string`

The name of the LLM class

#### Defined in

[llms/base.ts:32](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/base.ts#L32)

___

### verbose

• `Optional` **verbose**: `boolean` = `false`

Whether to print out response text.

#### Defined in

[llms/base.ts:41](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/base.ts#L41)

## Methods

### \_generate

▸ `Abstract` **_generate**(`prompts`, `stop?`): `Promise`<[`LLMResult`](../modules/llms.md#llmresult)\>

Run the LLM on the given prompts and input.

#### Parameters

| Name | Type |
| :------ | :------ |
| `prompts` | `string`[] |
| `stop?` | `string`[] |

#### Returns

`Promise`<[`LLMResult`](../modules/llms.md#llmresult)\>

#### Defined in

[llms/base.ts:51](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/base.ts#L51)

___

### \_identifyingParams

▸ **_identifyingParams**(): `Record`<`string`, `any`\>

Get the identifying parameters of the LLM.

#### Returns

`Record`<`string`, `any`\>

#### Defined in

[llms/base.ts:133](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/base.ts#L133)

___

### \_llmType

▸ `Abstract` **_llmType**(): `string`

Return the string type key uniquely identifying this class of LLM.

#### Returns

`string`

#### Defined in

[llms/base.ts:140](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/base.ts#L140)

___

### call

▸ **call**(`prompt`, `stop?`): `Promise`<`string`\>

Convenience wrapper for [generate](llms.BaseLLM.md#generate) that takes in a single string prompt and returns a single string output.

#### Parameters

| Name | Type |
| :------ | :------ |
| `prompt` | `string` |
| `stop?` | `string`[] |

#### Returns

`Promise`<`string`\>

#### Defined in

[llms/base.ts:124](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/base.ts#L124)

___

### generate

▸ **generate**(`prompts`, `stop?`): `Promise`<[`LLMResult`](../modules/llms.md#llmresult)\>

Run the LLM on the given propmts an input, handling caching.

#### Parameters

| Name | Type |
| :------ | :------ |
| `prompts` | `string`[] |
| `stop?` | `string`[] |

#### Returns

`Promise`<[`LLMResult`](../modules/llms.md#llmresult)\>

#### Defined in

[llms/base.ts:78](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/base.ts#L78)

___

### serialize

▸ **serialize**(): [`SerializedLLM`](../modules/llms.md#serializedllm)

Return a json-like object representing this LLM.

#### Returns

[`SerializedLLM`](../modules/llms.md#serializedllm)

#### Defined in

[llms/base.ts:145](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/base.ts#L145)

___

### deserialize

▸ `Static` **deserialize**(`data`): `Promise`<[`BaseLLM`](llms.BaseLLM.md)\>

Load an LLM from a json-like object describing it.

#### Parameters

| Name | Type |
| :------ | :------ |
| `data` | [`SerializedLLM`](../modules/llms.md#serializedllm) |

#### Returns

`Promise`<[`BaseLLM`](llms.BaseLLM.md)\>

#### Defined in

[llms/base.ts:155](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/base.ts#L155)
