---
title: "AnalyzeDocumentChain"
---

# AnalyzeDocumentChain

Chain that combines documents by stuffing into context.

## Hierarchy

- [`BaseChain`](BaseChain.md).**AnalyzeDocumentChain**

## Implements

- [`AnalyzeDocumentChainInput`](../interfaces/AnalyzeDocumentChainInput.md)

## Constructors

### constructor()

> **new AnalyzeDocumentChain**(`fields`: [`AnalyzeDocumentChainInput`](../interfaces/AnalyzeDocumentChainInput.md)): [`AnalyzeDocumentChain`](AnalyzeDocumentChain.md)

#### Parameters

| Parameter | Type                                                                      |
| :-------- | :------------------------------------------------------------------------ |
| `fields`  | [`AnalyzeDocumentChainInput`](../interfaces/AnalyzeDocumentChainInput.md) |

#### Returns

[`AnalyzeDocumentChain`](AnalyzeDocumentChain.md)

#### Overrides

[BaseChain](BaseChain.md).[constructor](BaseChain.md#constructor)

#### Defined in

[langchain/src/chains/analyze_documents_chain.ts:34](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/analyze_documents_chain.ts#L34)

## Properties

### combineDocumentsChain

> **combineDocumentsChain**: [`BaseChain`](BaseChain.md)

#### Implementation of

[AnalyzeDocumentChainInput](../interfaces/AnalyzeDocumentChainInput.md).[combineDocumentsChain](../interfaces/AnalyzeDocumentChainInput.md#combinedocumentschain)

#### Defined in

[langchain/src/chains/analyze_documents_chain.ts:30](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/analyze_documents_chain.ts#L30)

### inputKey

> **inputKey**: `string` = `"input_document"`

#### Implementation of

[AnalyzeDocumentChainInput](../interfaces/AnalyzeDocumentChainInput.md).[inputKey](../interfaces/AnalyzeDocumentChainInput.md#inputkey)

#### Defined in

[langchain/src/chains/analyze_documents_chain.ts:28](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/analyze_documents_chain.ts#L28)

### textSplitter

> **textSplitter**: [`TextSplitter`](../../text_splitter/classes/TextSplitter.md)

#### Implementation of

[AnalyzeDocumentChainInput](../interfaces/AnalyzeDocumentChainInput.md).[textSplitter](../interfaces/AnalyzeDocumentChainInput.md#textsplitter)

#### Defined in

[langchain/src/chains/analyze_documents_chain.ts:32](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/analyze_documents_chain.ts#L32)

### verbose

> **verbose**: `boolean`

Whether to print out response text.

#### Implementation of

[AnalyzeDocumentChainInput](../interfaces/AnalyzeDocumentChainInput.md).[verbose](../interfaces/AnalyzeDocumentChainInput.md#verbose)

#### Inherited from

[BaseChain](BaseChain.md).[verbose](BaseChain.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L27)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Implementation of

[AnalyzeDocumentChainInput](../interfaces/AnalyzeDocumentChainInput.md).[callbacks](../interfaces/AnalyzeDocumentChainInput.md#callbacks)

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

[langchain/src/chains/analyze_documents_chain.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/analyze_documents_chain.ts#L42)

#### Overrides

[BaseChain](BaseChain.md).[inputKeys](BaseChain.md#inputkeys)

#### Defined in

[langchain/src/chains/analyze_documents_chain.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/analyze_documents_chain.ts#L42)

### outputKeys

> **outputKeys**(): `string`[]

#### Returns

`string`[]

#### Overrides

BaseChain.outputKeys

#### Defined in

[langchain/src/chains/analyze_documents_chain.ts:46](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/analyze_documents_chain.ts#L46)

#### Overrides

[BaseChain](BaseChain.md).[outputKeys](BaseChain.md#outputkeys)

#### Defined in

[langchain/src/chains/analyze_documents_chain.ts:46](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/analyze_documents_chain.ts#L46)

## Methods

### \_chainType()

Return the string type key uniquely identifying this class of chain.

> **\_chainType**(): "analyze_document_chain"

#### Returns

"analyze_document_chain"

#### Overrides

[BaseChain](BaseChain.md).[\_chainType](BaseChain.md#_chaintype)

#### Defined in

[langchain/src/chains/analyze_documents_chain.ts:71](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/analyze_documents_chain.ts#L71)

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

> **serialize**(): [`SerializedAnalyzeDocumentChain`](../types/SerializedAnalyzeDocumentChain.md)

#### Returns

[`SerializedAnalyzeDocumentChain`](../types/SerializedAnalyzeDocumentChain.md)

#### Overrides

[BaseChain](BaseChain.md).[serialize](BaseChain.md#serialize)

#### Defined in

[langchain/src/chains/analyze_documents_chain.ts:100](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/analyze_documents_chain.ts#L100)

### deserialize()

Load a chain from a json-like object describing it.

> `Static` **deserialize**(`data`: [`SerializedAnalyzeDocumentChain`](../types/SerializedAnalyzeDocumentChain.md), `values`: `LoadValues`): `Promise`<[`AnalyzeDocumentChain`](AnalyzeDocumentChain.md)\>

#### Parameters

| Parameter | Type                                                                           |
| :-------- | :----------------------------------------------------------------------------- |
| `data`    | [`SerializedAnalyzeDocumentChain`](../types/SerializedAnalyzeDocumentChain.md) |
| `values`  | `LoadValues`                                                                   |

#### Returns

`Promise`<[`AnalyzeDocumentChain`](AnalyzeDocumentChain.md)\>

#### Overrides

[BaseChain](BaseChain.md).[deserialize](BaseChain.md#deserialize)

#### Defined in

[langchain/src/chains/analyze_documents_chain.ts:75](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/analyze_documents_chain.ts#L75)
