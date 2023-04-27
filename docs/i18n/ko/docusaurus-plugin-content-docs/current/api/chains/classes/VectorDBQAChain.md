---
title: "VectorDBQAChain"
---

# VectorDBQAChain

Base interface that all chains must implement.

## Hierarchy

- [`BaseChain`](BaseChain.md).**VectorDBQAChain**

## Implements

- [`VectorDBQAChainInput`](../interfaces/VectorDBQAChainInput.md)

## Constructors

### constructor()

> **new VectorDBQAChain**(`fields`: [`VectorDBQAChainInput`](../interfaces/VectorDBQAChainInput.md)): [`VectorDBQAChain`](VectorDBQAChain.md)

#### Parameters

| Parameter | Type                                                            |
| :-------- | :-------------------------------------------------------------- |
| `fields`  | [`VectorDBQAChainInput`](../interfaces/VectorDBQAChainInput.md) |

#### Returns

[`VectorDBQAChain`](VectorDBQAChain.md)

#### Overrides

[BaseChain](BaseChain.md).[constructor](BaseChain.md#constructor)

#### Defined in

[langchain/src/chains/vector_db_qa.ts:41](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/vector_db_qa.ts#L41)

## Properties

### combineDocumentsChain

> **combineDocumentsChain**: [`BaseChain`](BaseChain.md)

#### Implementation of

[VectorDBQAChainInput](../interfaces/VectorDBQAChainInput.md).[combineDocumentsChain](../interfaces/VectorDBQAChainInput.md#combinedocumentschain)

#### Defined in

[langchain/src/chains/vector_db_qa.ts:37](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/vector_db_qa.ts#L37)

### inputKey

> **inputKey**: `string` = `"query"`

#### Implementation of

[VectorDBQAChainInput](../interfaces/VectorDBQAChainInput.md).[inputKey](../interfaces/VectorDBQAChainInput.md#inputkey)

#### Defined in

[langchain/src/chains/vector_db_qa.ts:23](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/vector_db_qa.ts#L23)

### k

> **k**: `number` = `4`

#### Implementation of

[VectorDBQAChainInput](../interfaces/VectorDBQAChainInput.md).[k](../interfaces/VectorDBQAChainInput.md#k)

#### Defined in

[langchain/src/chains/vector_db_qa.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/vector_db_qa.ts#L21)

### returnSourceDocuments

> **returnSourceDocuments**: `boolean` = `false`

#### Implementation of

[VectorDBQAChainInput](../interfaces/VectorDBQAChainInput.md).[returnSourceDocuments](../interfaces/VectorDBQAChainInput.md#returnsourcedocuments)

#### Defined in

[langchain/src/chains/vector_db_qa.ts:39](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/vector_db_qa.ts#L39)

### vectorstore

> **vectorstore**: [`VectorStore`](../../vectorstores_base/classes/VectorStore.md)

#### Implementation of

[VectorDBQAChainInput](../interfaces/VectorDBQAChainInput.md).[vectorstore](../interfaces/VectorDBQAChainInput.md#vectorstore)

#### Defined in

[langchain/src/chains/vector_db_qa.ts:35](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/vector_db_qa.ts#L35)

### verbose

> **verbose**: `boolean`

Whether to print out response text.

#### Implementation of

[VectorDBQAChainInput](../interfaces/VectorDBQAChainInput.md).[verbose](../interfaces/VectorDBQAChainInput.md#verbose)

#### Inherited from

[BaseChain](BaseChain.md).[verbose](BaseChain.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L27)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Implementation of

[VectorDBQAChainInput](../interfaces/VectorDBQAChainInput.md).[callbacks](../interfaces/VectorDBQAChainInput.md#callbacks)

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

[langchain/src/chains/vector_db_qa.ts:25](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/vector_db_qa.ts#L25)

#### Overrides

[BaseChain](BaseChain.md).[inputKeys](BaseChain.md#inputkeys)

#### Defined in

[langchain/src/chains/vector_db_qa.ts:25](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/vector_db_qa.ts#L25)

### outputKeys

> **outputKeys**(): `string`[]

#### Returns

`string`[]

#### Overrides

BaseChain.outputKeys

#### Defined in

[langchain/src/chains/vector_db_qa.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/vector_db_qa.ts#L29)

#### Overrides

[BaseChain](BaseChain.md).[outputKeys](BaseChain.md#outputkeys)

#### Defined in

[langchain/src/chains/vector_db_qa.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/vector_db_qa.ts#L29)

## Methods

### \_chainType()

Return the string type key uniquely identifying this class of chain.

> **\_chainType**(): "vector_db_qa"

#### Returns

"vector_db_qa"

#### Overrides

[BaseChain](BaseChain.md).[\_chainType](BaseChain.md#_chaintype)

#### Defined in

[langchain/src/chains/vector_db_qa.ts:75](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/vector_db_qa.ts#L75)

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

[langchain/src/chains/vector_db_qa.ts:104](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/vector_db_qa.ts#L104)

### deserialize()

Load a chain from a json-like object describing it.

> `Static` **deserialize**(`data`: [`SerializedVectorDBQAChain`](../types/SerializedVectorDBQAChain.md), `values`: `LoadValues`): `Promise`<[`VectorDBQAChain`](VectorDBQAChain.md)\>

#### Parameters

| Parameter | Type                                                                 |
| :-------- | :------------------------------------------------------------------- |
| `data`    | [`SerializedVectorDBQAChain`](../types/SerializedVectorDBQAChain.md) |
| `values`  | `LoadValues`                                                         |

#### Returns

`Promise`<[`VectorDBQAChain`](VectorDBQAChain.md)\>

#### Overrides

[BaseChain](BaseChain.md).[deserialize](BaseChain.md#deserialize)

#### Defined in

[langchain/src/chains/vector_db_qa.ts:79](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/vector_db_qa.ts#L79)

### fromLLM()

> `Static` **fromLLM**(`llm`: [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md), `vectorstore`: [`VectorStore`](../../vectorstores_base/classes/VectorStore.md), `options`?: `Partial`<`Omit`<[`VectorDBQAChainInput`](../interfaces/VectorDBQAChainInput.md), "vectorstore" \| "combineDocumentsChain"\>\>): [`VectorDBQAChain`](VectorDBQAChain.md)

#### Parameters

| Parameter     | Type                                                                                                                             |
| :------------ | :------------------------------------------------------------------------------------------------------------------------------- |
| `llm`         | [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md)                                                          |
| `vectorstore` | [`VectorStore`](../../vectorstores_base/classes/VectorStore.md)                                                                  |
| `options?`    | `Partial`<`Omit`<[`VectorDBQAChainInput`](../interfaces/VectorDBQAChainInput.md), "vectorstore" \| "combineDocumentsChain"\>\> |

#### Returns

[`VectorDBQAChain`](VectorDBQAChain.md)

#### Defined in

[langchain/src/chains/vector_db_qa.ts:112](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/vector_db_qa.ts#L112)
