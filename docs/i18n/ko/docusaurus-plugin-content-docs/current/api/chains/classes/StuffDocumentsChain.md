---
title: "StuffDocumentsChain"
---

# StuffDocumentsChain

Chain that combines documents by stuffing into context.

## Hierarchy

- [`BaseChain`](BaseChain.md).**StuffDocumentsChain**

## Implements

- [`StuffDocumentsChainInput`](../interfaces/StuffDocumentsChainInput.md)

## Constructors

### constructor()

> **new StuffDocumentsChain**(`fields`: [`StuffDocumentsChainInput`](../interfaces/StuffDocumentsChainInput.md)): [`StuffDocumentsChain`](StuffDocumentsChain.md)

#### Parameters

| Parameter | Type                                                                    |
| :-------- | :---------------------------------------------------------------------- |
| `fields`  | [`StuffDocumentsChainInput`](../interfaces/StuffDocumentsChainInput.md) |

#### Returns

[`StuffDocumentsChain`](StuffDocumentsChain.md)

#### Overrides

[BaseChain](BaseChain.md).[constructor](BaseChain.md#constructor)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:47](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L47)

## Properties

### documentVariableName

> **documentVariableName**: `string` = `"context"`

Variable name in the LLM chain to put the documents in

#### Implementation of

[StuffDocumentsChainInput](../interfaces/StuffDocumentsChainInput.md).[documentVariableName](../interfaces/StuffDocumentsChainInput.md#documentvariablename)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:37](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L37)

### inputKey

> **inputKey**: `string` = `"input_documents"`

#### Implementation of

[StuffDocumentsChainInput](../interfaces/StuffDocumentsChainInput.md).[inputKey](../interfaces/StuffDocumentsChainInput.md#inputkey)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:35](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L35)

### llmChain

> **llmChain**: [`LLMChain`](LLMChain.md)

LLM Wrapper to use after formatting documents

#### Implementation of

[StuffDocumentsChainInput](../interfaces/StuffDocumentsChainInput.md).[llmChain](../interfaces/StuffDocumentsChainInput.md#llmchain)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:33](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L33)

### verbose

> **verbose**: `boolean`

Whether to print out response text.

#### Inherited from

[BaseChain](BaseChain.md).[verbose](BaseChain.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L27)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Inherited from

[BaseChain](BaseChain.md).[callbacks](BaseChain.md#callbacks)

#### Defined in

[langchain/src/base_language/index.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L29)

### memory?

> **memory**: [`BaseMemory`](../../memory/classes/BaseMemory.md)

#### Inherited from

[BaseChain](BaseChain.md).[memory](BaseChain.md#memory)

#### Defined in

[langchain/src/chains/base.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L27)

## Accessors

### inputKeys

> **inputKeys**(): `string`[]

#### Returns

`string`[]

#### Overrides

BaseChain.inputKeys

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:39](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L39)

#### Overrides

[BaseChain](BaseChain.md).[inputKeys](BaseChain.md#inputkeys)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:39](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L39)

### outputKeys

> **outputKeys**(): `string`[]

#### Returns

`string`[]

#### Overrides

BaseChain.outputKeys

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:43](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L43)

#### Overrides

[BaseChain](BaseChain.md).[outputKeys](BaseChain.md#outputkeys)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:43](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L43)

## Methods

### \_chainType()

Return the string type key uniquely identifying this class of chain.

> **\_chainType**(): "stuff_documents_chain"

#### Returns

"stuff_documents_chain"

#### Overrides

[BaseChain](BaseChain.md).[\_chainType](BaseChain.md#_chaintype)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:76](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L76)

### apply()

Call the chain on all inputs in the list

> **apply**(`inputs`: [`ChainValues`](../../schema/types/ChainValues.md)[], `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)[]): `Promise`<[`ChainValues`](../../schema/types/ChainValues.md)\>

#### Parameters

| Parameter    | Type                                                 |
| :----------- | :--------------------------------------------------- |
| `inputs`     | [`ChainValues`](../../schema/types/ChainValues.md)[] |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md)[]  |

#### Returns

`Promise`<[`ChainValues`](../../schema/types/ChainValues.md)\>

#### Inherited from

[BaseChain](BaseChain.md).[apply](BaseChain.md#apply)

#### Defined in

[langchain/src/chains/base.ts:123](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L123)

### call()

Run the core logic of this chain and add to output if desired.

Wraps \_call and handles memory.

> **call**(`values`: [`ChainValues`](../../schema/types/ChainValues.md), `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<[`ChainValues`](../../schema/types/ChainValues.md)\>

#### Parameters

| Parameter    | Type                                               |
| :----------- | :------------------------------------------------- |
| `values`     | [`ChainValues`](../../schema/types/ChainValues.md) |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md)  |

#### Returns

`Promise`<[`ChainValues`](../../schema/types/ChainValues.md)\>

#### Inherited from

[BaseChain](BaseChain.md).[call](BaseChain.md#call)

#### Defined in

[langchain/src/chains/base.ts:84](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L84)

### run()

> **run**(`input`: `any`, `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<`string`\>

#### Parameters

| Parameter    | Type                                              |
| :----------- | :------------------------------------------------ |
| `input`      | `any`                                             |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md) |

#### Returns

`Promise`<`string`\>

#### Inherited from

[BaseChain](BaseChain.md).[run](BaseChain.md#run)

#### Defined in

[langchain/src/chains/base.ts:56](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L56)

### serialize()

Return a json-like object representing this chain.

> **serialize**(): [`SerializedStuffDocumentsChain`](../types/SerializedStuffDocumentsChain.md)

#### Returns

[`SerializedStuffDocumentsChain`](../types/SerializedStuffDocumentsChain.md)

#### Overrides

[BaseChain](BaseChain.md).[serialize](BaseChain.md#serialize)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:90](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L90)

### deserialize()

Load a chain from a json-like object describing it.

> `Static` **deserialize**(`data`: [`SerializedStuffDocumentsChain`](../types/SerializedStuffDocumentsChain.md)): `Promise`<[`StuffDocumentsChain`](StuffDocumentsChain.md)\>

#### Parameters

| Parameter | Type                                                                         |
| :-------- | :--------------------------------------------------------------------------- |
| `data`    | [`SerializedStuffDocumentsChain`](../types/SerializedStuffDocumentsChain.md) |

#### Returns

`Promise`<[`StuffDocumentsChain`](StuffDocumentsChain.md)\>

#### Overrides

[BaseChain](BaseChain.md).[deserialize](BaseChain.md#deserialize)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:80](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L80)
