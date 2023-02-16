---
id: "index.LLMChain"
title: "Class: LLMChain"
sidebar_label: "LLMChain"
custom_edit_url: null
---

[index](../modules/).LLMChain

Chain to run queries against LLMs.

**`Example`**

```ts
import { LLMChain, OpenAI, PromptTemplate } from "langchain";
const prompt = PromptTemplate.fromTemplate("Tell me a {adjective} joke");
const llm = LLMChain({ llm: new OpenAI(), prompt });
```

## Hierarchy

- [`BaseChain`](chains.BaseChain.md)

  ↳ **`LLMChain`**

## Implements

- [`LLMChainInput`](../interfaces/.internal.LLMChainInput)

## Constructors

### constructor

• **new LLMChain**(`fields`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `fields` | `Object` |
| `fields.llm` | [`BaseLLM`](llms.BaseLLM.md) |
| `fields.outputKey?` | `string` |
| `fields.prompt` | [`BasePromptTemplate`](.BasePromptTemplate) |

#### Overrides

[BaseChain](chains.BaseChain.md).[constructor](chains.BaseChain.md#constructor)

#### Defined in

[chains/llm_chain.ts:45](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/chains/llm_chain.ts#L45)

## Properties

### llm

• **llm**: [`BaseLLM`](llms.BaseLLM.md)

LLM Wrapper to use

#### Implementation of

[LLMChainInput](../interfaces/.internal.LLMChainInput).[llm](../interfaces/.internal.LLMChainInput#llm)

#### Defined in

[chains/llm_chain.ts:41](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/chains/llm_chain.ts#L41)

___

### outputKey

• **outputKey**: `string` = `"text"`

#### Implementation of

LLMChainInput.outputKey

#### Defined in

[chains/llm_chain.ts:43](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/chains/llm_chain.ts#L43)

___

### prompt

• **prompt**: [`BasePromptTemplate`](.BasePromptTemplate)

Prompt object to use

#### Implementation of

[LLMChainInput](../interfaces/.internal.LLMChainInput).[prompt](../interfaces/.internal.LLMChainInput#prompt)

#### Defined in

[chains/llm_chain.ts:39](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/chains/llm_chain.ts#L39)

## Methods

### \_call

▸ **_call**(`values`): `Promise`<[`ChainValues`](../modules/chains.md#chainvalues)\>

Run the core logic of this chain and return the output

#### Parameters

| Name | Type |
| :------ | :------ |
| `values` | [`ChainValues`](../modules/chains.md#chainvalues) |

#### Returns

`Promise`<[`ChainValues`](../modules/chains.md#chainvalues)\>

#### Overrides

[BaseChain](chains.BaseChain.md).[_call](chains.BaseChain.md#_call)

#### Defined in

[chains/llm_chain.ts:56](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/chains/llm_chain.ts#L56)

___

### \_chainType

▸ **_chainType**(): ``"llm_chain"``

Return the string type key uniquely identifying this class of chain.

#### Returns

``"llm_chain"``

#### Overrides

[BaseChain](chains.BaseChain.md).[_chainType](chains.BaseChain.md#_chaintype)

#### Defined in

[chains/llm_chain.ts:83](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/chains/llm_chain.ts#L83)

___

### apply

▸ **apply**(`inputs`): [`ChainValues`](../modules/chains.md#chainvalues)[]

Call the chain on all inputs in the list

#### Parameters

| Name | Type |
| :------ | :------ |
| `inputs` | [`ChainValues`](../modules/chains.md#chainvalues)[] |

#### Returns

[`ChainValues`](../modules/chains.md#chainvalues)[]

#### Inherited from

[BaseChain](chains.BaseChain.md).[apply](chains.BaseChain.md#apply)

#### Defined in

[chains/base.ts:43](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/chains/base.ts#L43)

___

### call

▸ **call**(`values`): `Promise`<[`ChainValues`](../modules/chains.md#chainvalues)\>

Run the core logic of this chain and add to output if desired.

Eventually will handle memory, validation, etc. but for now just wraps [_call](.LLMChain#_call)

#### Parameters

| Name | Type |
| :------ | :------ |
| `values` | [`ChainValues`](../modules/chains.md#chainvalues) |

#### Returns

`Promise`<[`ChainValues`](../modules/chains.md#chainvalues)\>

#### Inherited from

[BaseChain](chains.BaseChain.md).[call](chains.BaseChain.md#call)

#### Defined in

[chains/base.ts:35](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/chains/base.ts#L35)

___

### predict

▸ **predict**(`values`): `Promise`<`string`\>

Format prompt with values and pass to LLM

**`Example`**

```ts
llm.predict({ adjective: "funny" })
```

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `values` | [`ChainValues`](../modules/chains.md#chainvalues) | keys to pass to prompt template |

#### Returns

`Promise`<`string`\>

Completion from LLM.

#### Defined in

[chains/llm_chain.ts:78](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/chains/llm_chain.ts#L78)

___

### serialize

▸ **serialize**(): [`SerializedLLMChain`](../modules/chains.md#serializedllmchain)

Return a json-like object representing this chain.

#### Returns

[`SerializedLLMChain`](../modules/chains.md#serializedllmchain)

#### Overrides

[BaseChain](chains.BaseChain.md).[serialize](chains.BaseChain.md#serialize)

#### Defined in

[chains/llm_chain.ts:103](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/chains/llm_chain.ts#L103)

___

### deserialize

▸ `Static` **deserialize**(`data`): `Promise`<[`LLMChain`](.LLMChain)\>

Load a chain from a json-like object describing it.

#### Parameters

| Name | Type |
| :------ | :------ |
| `data` | [`SerializedLLMChain`](../modules/chains.md#serializedllmchain) |

#### Returns

`Promise`<[`LLMChain`](.LLMChain)\>

#### Overrides

[BaseChain](chains.BaseChain.md).[deserialize](chains.BaseChain.md#deserialize)

#### Defined in

[chains/llm_chain.ts:87](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/chains/llm_chain.ts#L87)
