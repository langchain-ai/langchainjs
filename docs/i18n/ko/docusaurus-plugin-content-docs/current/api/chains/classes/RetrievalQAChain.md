---
title: "RetrievalQAChain"
---

# RetrievalQAChain

Base interface that all chains must implement.

## Hierarchy

- [`BaseChain`](BaseChain.md).**RetrievalQAChain**

## Implements

- [`RetrievalQAChainInput`](../interfaces/RetrievalQAChainInput.md)

## Constructors

### constructor()

> **new RetrievalQAChain**(`fields`: [`RetrievalQAChainInput`](../interfaces/RetrievalQAChainInput.md)): [`RetrievalQAChain`](RetrievalQAChain.md)

#### Parameters

| Parameter | Type                                                              |
| :-------- | :---------------------------------------------------------------- |
| `fields`  | [`RetrievalQAChainInput`](../interfaces/RetrievalQAChainInput.md) |

#### Returns

[`RetrievalQAChain`](RetrievalQAChain.md)

#### Overrides

[BaseChain](BaseChain.md).[constructor](BaseChain.md#constructor)

#### Defined in

[langchain/src/chains/retrieval_qa.ts:40](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/retrieval_qa.ts#L40)

## Properties

### combineDocumentsChain

> **combineDocumentsChain**: [`BaseChain`](BaseChain.md)

#### Implementation of

[RetrievalQAChainInput](../interfaces/RetrievalQAChainInput.md).[combineDocumentsChain](../interfaces/RetrievalQAChainInput.md#combinedocumentschain)

#### Defined in

[langchain/src/chains/retrieval_qa.ts:36](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/retrieval_qa.ts#L36)

### inputKey

> **inputKey**: `string` = `"query"`

#### Implementation of

[RetrievalQAChainInput](../interfaces/RetrievalQAChainInput.md).[inputKey](../interfaces/RetrievalQAChainInput.md#inputkey)

#### Defined in

[langchain/src/chains/retrieval_qa.ts:22](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/retrieval_qa.ts#L22)

### retriever

> **retriever**: [`BaseRetriever`](../../schema/classes/BaseRetriever.md)

#### Implementation of

[RetrievalQAChainInput](../interfaces/RetrievalQAChainInput.md).[retriever](../interfaces/RetrievalQAChainInput.md#retriever)

#### Defined in

[langchain/src/chains/retrieval_qa.ts:34](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/retrieval_qa.ts#L34)

### returnSourceDocuments

> **returnSourceDocuments**: `boolean` = `false`

#### Implementation of

[RetrievalQAChainInput](../interfaces/RetrievalQAChainInput.md).[returnSourceDocuments](../interfaces/RetrievalQAChainInput.md#returnsourcedocuments)

#### Defined in

[langchain/src/chains/retrieval_qa.ts:38](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/retrieval_qa.ts#L38)

### verbose

> **verbose**: `boolean`

Whether to print out response text.

#### Implementation of

[RetrievalQAChainInput](../interfaces/RetrievalQAChainInput.md).[verbose](../interfaces/RetrievalQAChainInput.md#verbose)

#### Inherited from

[BaseChain](BaseChain.md).[verbose](BaseChain.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L27)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Implementation of

[RetrievalQAChainInput](../interfaces/RetrievalQAChainInput.md).[callbacks](../interfaces/RetrievalQAChainInput.md#callbacks)

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

[langchain/src/chains/retrieval_qa.ts:24](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/retrieval_qa.ts#L24)

#### Overrides

[BaseChain](BaseChain.md).[inputKeys](BaseChain.md#inputkeys)

#### Defined in

[langchain/src/chains/retrieval_qa.ts:24](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/retrieval_qa.ts#L24)

### outputKeys

> **outputKeys**(): `string`[]

#### Returns

`string`[]

#### Overrides

BaseChain.outputKeys

#### Defined in

[langchain/src/chains/retrieval_qa.ts:28](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/retrieval_qa.ts#L28)

#### Overrides

[BaseChain](BaseChain.md).[outputKeys](BaseChain.md#outputkeys)

#### Defined in

[langchain/src/chains/retrieval_qa.ts:28](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/retrieval_qa.ts#L28)

## Methods

### \_chainType()

Return the string type key uniquely identifying this class of chain.

> **\_chainType**(): "retrieval_qa"

#### Returns

"retrieval_qa"

#### Overrides

[BaseChain](BaseChain.md).[\_chainType](BaseChain.md#_chaintype)

#### Defined in

[langchain/src/chains/retrieval_qa.ts:73](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/retrieval_qa.ts#L73)

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

> **serialize**(): [`SerializedVectorDBQAChain`](../types/SerializedVectorDBQAChain.md)

#### Returns

[`SerializedVectorDBQAChain`](../types/SerializedVectorDBQAChain.md)

#### Overrides

[BaseChain](BaseChain.md).[serialize](BaseChain.md#serialize)

#### Defined in

[langchain/src/chains/retrieval_qa.ts:84](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/retrieval_qa.ts#L84)

### deserialize()

Load a chain from a json-like object describing it.

> `Static` **deserialize**(`_data`: [`SerializedVectorDBQAChain`](../types/SerializedVectorDBQAChain.md), `_values`: `LoadValues`): `Promise`<[`RetrievalQAChain`](RetrievalQAChain.md)\>

#### Parameters

| Parameter | Type                                                                 |
| :-------- | :------------------------------------------------------------------- |
| `_data`   | [`SerializedVectorDBQAChain`](../types/SerializedVectorDBQAChain.md) |
| `_values` | `LoadValues`                                                         |

#### Returns

`Promise`<[`RetrievalQAChain`](RetrievalQAChain.md)\>

#### Overrides

[BaseChain](BaseChain.md).[deserialize](BaseChain.md#deserialize)

#### Defined in

[langchain/src/chains/retrieval_qa.ts:77](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/retrieval_qa.ts#L77)

### fromLLM()

> `Static` **fromLLM**(`llm`: [`BaseLLM`](../../llms_base/classes/BaseLLM.md), `retriever`: [`BaseRetriever`](../../schema/classes/BaseRetriever.md), `options`?: `Partial`<`Omit`<[`RetrievalQAChainInput`](../interfaces/RetrievalQAChainInput.md), "index" \| "combineDocumentsChain"\>\>): [`RetrievalQAChain`](RetrievalQAChain.md)

#### Parameters

| Parameter   | Type                                                                                                                         |
| :---------- | :--------------------------------------------------------------------------------------------------------------------------- |
| `llm`       | [`BaseLLM`](../../llms_base/classes/BaseLLM.md)                                                                              |
| `retriever` | [`BaseRetriever`](../../schema/classes/BaseRetriever.md)                                                                     |
| `options?`  | `Partial`<`Omit`<[`RetrievalQAChainInput`](../interfaces/RetrievalQAChainInput.md), "index" \| "combineDocumentsChain"\>\> |

#### Returns

[`RetrievalQAChain`](RetrievalQAChain.md)

#### Defined in

[langchain/src/chains/retrieval_qa.ts:88](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/retrieval_qa.ts#L88)
