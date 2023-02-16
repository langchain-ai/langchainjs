---
id: "llms.LLM"
title: "Class: LLM"
sidebar_label: "LLM"
custom_edit_url: null
---

[llms](../modules/llms.md).LLM

LLM class that provides a simpler interface to subclass than [BaseLLM](llms.BaseLLM.md).

Requires only implementing a simpler [_call](llms.LLM.md#_call) method instead of [_generate](llms.LLM.md#_generate).

## Hierarchy

- [`BaseLLM`](llms.BaseLLM.md)

  ↳ **`LLM`**

## Constructors

### constructor

• **new LLM**(`callbackManager?`, `verbose?`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `callbackManager?` | [`LLMCallbackManager`](../modules/llms.md#llmcallbackmanager) |
| `verbose?` | `boolean` |

#### Inherited from

[BaseLLM](llms.BaseLLM.md).[constructor](llms.BaseLLM.md#constructor)

#### Defined in

[llms/base.ts:43](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/base.ts#L43)

## Properties

### cache

• `Optional` **cache**: `boolean`

#### Inherited from

[BaseLLM](llms.BaseLLM.md).[cache](llms.BaseLLM.md#cache)

#### Defined in

[llms/base.ts:34](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/base.ts#L34)

___

### callbackManager

• **callbackManager**: [`LLMCallbackManager`](../modules/llms.md#llmcallbackmanager)

#### Inherited from

[BaseLLM](llms.BaseLLM.md).[callbackManager](llms.BaseLLM.md#callbackmanager)

#### Defined in

[llms/base.ts:36](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/base.ts#L36)

___

### name

• **name**: `string`

The name of the LLM class

#### Inherited from

[BaseLLM](llms.BaseLLM.md).[name](llms.BaseLLM.md#name)

#### Defined in

[llms/base.ts:32](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/base.ts#L32)

___

### verbose

• `Optional` **verbose**: `boolean` = `false`

Whether to print out response text.

#### Inherited from

[BaseLLM](llms.BaseLLM.md).[verbose](llms.BaseLLM.md#verbose)

#### Defined in

[llms/base.ts:41](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/base.ts#L41)

## Methods

### \_call

▸ `Abstract` **_call**(`prompt`, `stop?`): `Promise`<`string`\>

Run the LLM on the given prompt and input.

#### Parameters

| Name | Type |
| :------ | :------ |
| `prompt` | `string` |
| `stop?` | `string`[] |

#### Returns

`Promise`<`string`\>

#### Defined in

[llms/base.ts:180](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/base.ts#L180)

___

### \_generate

▸ **_generate**(`prompts`, `stop?`): `Promise`<[`LLMResult`](../modules/llms.md#llmresult)\>

Run the LLM on the given prompts and input.

#### Parameters

| Name | Type |
| :------ | :------ |
| `prompts` | `string`[] |
| `stop?` | `string`[] |

#### Returns

`Promise`<[`LLMResult`](../modules/llms.md#llmresult)\>

#### Overrides

[BaseLLM](llms.BaseLLM.md).[_generate](llms.BaseLLM.md#_generate)

#### Defined in

[llms/base.ts:182](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/base.ts#L182)

___

### \_identifyingParams

▸ **_identifyingParams**(): `Record`<`string`, `any`\>

Get the identifying parameters of the LLM.

#### Returns

`Record`<`string`, `any`\>

#### Inherited from

[BaseLLM](llms.BaseLLM.md).[_identifyingParams](llms.BaseLLM.md#_identifyingparams)

#### Defined in

[llms/base.ts:133](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/base.ts#L133)

___

### \_llmType

▸ `Abstract` **_llmType**(): `string`

Return the string type key uniquely identifying this class of LLM.

#### Returns

`string`

#### Inherited from

[BaseLLM](llms.BaseLLM.md).[_llmType](llms.BaseLLM.md#_llmtype)

#### Defined in

[llms/base.ts:140](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/base.ts#L140)

___

### call

▸ **call**(`prompt`, `stop?`): `Promise`<`string`\>

Convenience wrapper for [generate](llms.LLM.md#generate) that takes in a single string prompt and returns a single string output.

#### Parameters

| Name | Type |
| :------ | :------ |
| `prompt` | `string` |
| `stop?` | `string`[] |

#### Returns

`Promise`<`string`\>

#### Inherited from

[BaseLLM](llms.BaseLLM.md).[call](llms.BaseLLM.md#call)

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

#### Inherited from

[BaseLLM](llms.BaseLLM.md).[generate](llms.BaseLLM.md#generate)

#### Defined in

[llms/base.ts:78](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/base.ts#L78)

___

### serialize

▸ **serialize**(): [`SerializedLLM`](../modules/llms.md#serializedllm)

Return a json-like object representing this LLM.

#### Returns

[`SerializedLLM`](../modules/llms.md#serializedllm)

#### Inherited from

[BaseLLM](llms.BaseLLM.md).[serialize](llms.BaseLLM.md#serialize)

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

#### Inherited from

[BaseLLM](llms.BaseLLM.md).[deserialize](llms.BaseLLM.md#deserialize)

#### Defined in

[llms/base.ts:155](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/llms/base.ts#L155)
