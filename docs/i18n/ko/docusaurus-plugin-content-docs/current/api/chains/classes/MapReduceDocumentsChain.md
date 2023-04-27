---
title: "MapReduceDocumentsChain"
---

# MapReduceDocumentsChain

Combine documents by mapping a chain over them, then combining results.

## Hierarchy

- [`BaseChain`](BaseChain.md).**MapReduceDocumentsChain**

## Implements

- [`MapReduceDocumentsChainInput`](../interfaces/MapReduceDocumentsChainInput.md)

## Constructors

### constructor()

> **new MapReduceDocumentsChain**(`fields`: [`MapReduceDocumentsChainInput`](../interfaces/MapReduceDocumentsChainInput.md)): [`MapReduceDocumentsChain`](MapReduceDocumentsChain.md)

#### Parameters

| Parameter | Type                                                                            |
| :-------- | :------------------------------------------------------------------------------ |
| `fields`  | [`MapReduceDocumentsChainInput`](../interfaces/MapReduceDocumentsChainInput.md) |

#### Returns

[`MapReduceDocumentsChain`](MapReduceDocumentsChain.md)

#### Overrides

[BaseChain](BaseChain.md).[constructor](BaseChain.md#constructor)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:136](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L136)

## Properties

### combineDocumentChain

> **combineDocumentChain**: [`BaseChain`](BaseChain.md)

#### Implementation of

[MapReduceDocumentsChainInput](../interfaces/MapReduceDocumentsChainInput.md).[combineDocumentChain](../interfaces/MapReduceDocumentsChainInput.md#combinedocumentchain)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:134](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L134)

### documentVariableName

> **documentVariableName**: `string` = `"context"`

Variable name in the LLM chain to put the documents in

#### Implementation of

[MapReduceDocumentsChainInput](../interfaces/MapReduceDocumentsChainInput.md).[documentVariableName](../interfaces/MapReduceDocumentsChainInput.md#documentvariablename)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:118](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L118)

### ensureMapStep

> **ensureMapStep**: `boolean` = `false`

#### Implementation of

[MapReduceDocumentsChainInput](../interfaces/MapReduceDocumentsChainInput.md).[ensureMapStep](../interfaces/MapReduceDocumentsChainInput.md#ensuremapstep)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:132](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L132)

### inputKey

> **inputKey**: `string` = `"input_documents"`

#### Implementation of

[MapReduceDocumentsChainInput](../interfaces/MapReduceDocumentsChainInput.md).[inputKey](../interfaces/MapReduceDocumentsChainInput.md#inputkey)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:116](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L116)

### llmChain

> **llmChain**: [`LLMChain`](LLMChain.md)

LLM Wrapper to use after formatting documents

#### Implementation of

[MapReduceDocumentsChainInput](../interfaces/MapReduceDocumentsChainInput.md).[llmChain](../interfaces/MapReduceDocumentsChainInput.md#llmchain)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:114](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L114)

### maxIterations

> **maxIterations**: `number` = `10`

#### Implementation of

[MapReduceDocumentsChainInput](../interfaces/MapReduceDocumentsChainInput.md).[maxIterations](../interfaces/MapReduceDocumentsChainInput.md#maxiterations)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:130](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L130)

### maxTokens

> **maxTokens**: `number` = `3000`

#### Implementation of

[MapReduceDocumentsChainInput](../interfaces/MapReduceDocumentsChainInput.md).[maxTokens](../interfaces/MapReduceDocumentsChainInput.md#maxtokens)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:128](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L128)

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

[langchain/src/chains/combine_docs_chain.ts:120](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L120)

#### Overrides

[BaseChain](BaseChain.md).[inputKeys](BaseChain.md#inputkeys)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:120](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L120)

### outputKeys

> **outputKeys**(): `string`[]

#### Returns

`string`[]

#### Overrides

BaseChain.outputKeys

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:124](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L124)

#### Overrides

[BaseChain](BaseChain.md).[outputKeys](BaseChain.md#outputkeys)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:124](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L124)

## Methods

### \_chainType()

Return the string type key uniquely identifying this class of chain.

> **\_chainType**(): "map_reduce_documents_chain"

#### Returns

"map_reduce_documents_chain"

#### Overrides

[BaseChain](BaseChain.md).[\_chainType](BaseChain.md#_chaintype)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:198](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L198)

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

> **serialize**(): [`SerializedMapReduceDocumentsChain`](../types/SerializedMapReduceDocumentsChain.md)

#### Returns

[`SerializedMapReduceDocumentsChain`](../types/SerializedMapReduceDocumentsChain.md)

#### Overrides

[BaseChain](BaseChain.md).[serialize](BaseChain.md#serialize)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:219](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L219)

### deserialize()

Load a chain from a json-like object describing it.

> `Static` **deserialize**(`data`: [`SerializedMapReduceDocumentsChain`](../types/SerializedMapReduceDocumentsChain.md)): `Promise`<[`MapReduceDocumentsChain`](MapReduceDocumentsChain.md)\>

#### Parameters

| Parameter | Type                                                                                 |
| :-------- | :----------------------------------------------------------------------------------- |
| `data`    | [`SerializedMapReduceDocumentsChain`](../types/SerializedMapReduceDocumentsChain.md) |

#### Returns

`Promise`<[`MapReduceDocumentsChain`](MapReduceDocumentsChain.md)\>

#### Overrides

[BaseChain](BaseChain.md).[deserialize](BaseChain.md#deserialize)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:202](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L202)
