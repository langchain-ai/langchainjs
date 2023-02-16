---
id: "chains.StuffDocumentsChain"
title: "Class: StuffDocumentsChain"
sidebar_label: "StuffDocumentsChain"
custom_edit_url: null
---

[chains](../modules/chains.md).StuffDocumentsChain

Chain that combines documents by stuffing into context.

## Hierarchy

- [`BaseChain`](chains.BaseChain.md)

  ↳ **`StuffDocumentsChain`**

## Implements

- [`StuffDocumentsChainInput`](../interfaces/chains.internal.StuffDocumentsChainInput.md)

## Constructors

### constructor

• **new StuffDocumentsChain**(`fields`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `fields` | `Object` |
| `fields.documentVariableName?` | `string` |
| `fields.inputKey?` | `string` |
| `fields.llmChain` | [`LLMChain`](.LLMChain) |
| `fields.outputKey?` | `string` |

#### Overrides

[BaseChain](chains.BaseChain.md).[constructor](chains.BaseChain.md#constructor)

#### Defined in

[chains/combine_docs_chain.ts:39](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/chains/combine_docs_chain.ts#L39)

## Properties

### documentVariableName

• **documentVariableName**: `string` = `"context"`

Variable name in the LLM chain to put the documents in

#### Implementation of

[StuffDocumentsChainInput](../interfaces/chains.internal.StuffDocumentsChainInput.md).[documentVariableName](../interfaces/chains.internal.StuffDocumentsChainInput.md#documentvariablename)

#### Defined in

[chains/combine_docs_chain.ts:37](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/chains/combine_docs_chain.ts#L37)

___

### inputKey

• **inputKey**: `string` = `"input_documents"`

#### Implementation of

[StuffDocumentsChainInput](../interfaces/chains.internal.StuffDocumentsChainInput.md).[inputKey](../interfaces/chains.internal.StuffDocumentsChainInput.md#inputkey)

#### Defined in

[chains/combine_docs_chain.ts:33](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/chains/combine_docs_chain.ts#L33)

___

### llmChain

• **llmChain**: [`LLMChain`](.LLMChain)

LLM Wrapper to use after formatting documents

#### Implementation of

[StuffDocumentsChainInput](../interfaces/chains.internal.StuffDocumentsChainInput.md).[llmChain](../interfaces/chains.internal.StuffDocumentsChainInput.md#llmchain)

#### Defined in

[chains/combine_docs_chain.ts:31](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/chains/combine_docs_chain.ts#L31)

___

### outputKey

• **outputKey**: `string` = `"output_text"`

#### Implementation of

[StuffDocumentsChainInput](../interfaces/chains.internal.StuffDocumentsChainInput.md).[outputKey](../interfaces/chains.internal.StuffDocumentsChainInput.md#outputkey)

#### Defined in

[chains/combine_docs_chain.ts:35](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/chains/combine_docs_chain.ts#L35)

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

[chains/combine_docs_chain.ts:53](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/chains/combine_docs_chain.ts#L53)

___

### \_chainType

▸ **_chainType**(): ``"stuff_documents_chain"``

Return the string type key uniquely identifying this class of chain.

#### Returns

``"stuff_documents_chain"``

#### Overrides

[BaseChain](chains.BaseChain.md).[_chainType](chains.BaseChain.md#_chaintype)

#### Defined in

[chains/combine_docs_chain.ts:67](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/chains/combine_docs_chain.ts#L67)

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

Eventually will handle memory, validation, etc. but for now just wraps [_call](chains.StuffDocumentsChain.md#_call)

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

### serialize

▸ **serialize**(): [`SerializedStuffDocumentsChain`](../modules/chains.md#serializedstuffdocumentschain)

Return a json-like object representing this chain.

#### Returns

[`SerializedStuffDocumentsChain`](../modules/chains.md#serializedstuffdocumentschain)

#### Overrides

[BaseChain](chains.BaseChain.md).[serialize](chains.BaseChain.md#serialize)

#### Defined in

[chains/combine_docs_chain.ts:82](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/chains/combine_docs_chain.ts#L82)

___

### deserialize

▸ `Static` **deserialize**(`data`): `Promise`<[`StuffDocumentsChain`](chains.StuffDocumentsChain.md)\>

Load a chain from a json-like object describing it.

#### Parameters

| Name | Type |
| :------ | :------ |
| `data` | [`SerializedStuffDocumentsChain`](../modules/chains.md#serializedstuffdocumentschain) |

#### Returns

`Promise`<[`StuffDocumentsChain`](chains.StuffDocumentsChain.md)\>

#### Overrides

[BaseChain](chains.BaseChain.md).[deserialize](chains.BaseChain.md#deserialize)

#### Defined in

[chains/combine_docs_chain.ts:71](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/chains/combine_docs_chain.ts#L71)
