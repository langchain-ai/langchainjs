---
title: "ConversationalRetrievalQAChain"
---

# ConversationalRetrievalQAChain

Base interface that all chains must implement.

## Hierarchy

- [`BaseChain`](BaseChain.md).**ConversationalRetrievalQAChain**

## Implements

- [`ConversationalRetrievalQAChainInput`](../interfaces/ConversationalRetrievalQAChainInput.md)

## Constructors

### constructor()

> **new ConversationalRetrievalQAChain**(`fields`: [`ConversationalRetrievalQAChainInput`](../interfaces/ConversationalRetrievalQAChainInput.md)): [`ConversationalRetrievalQAChain`](ConversationalRetrievalQAChain.md)

#### Parameters

| Parameter | Type                                                                                          |
| :-------- | :-------------------------------------------------------------------------------------------- |
| `fields`  | [`ConversationalRetrievalQAChainInput`](../interfaces/ConversationalRetrievalQAChainInput.md) |

#### Returns

[`ConversationalRetrievalQAChain`](ConversationalRetrievalQAChain.md)

#### Overrides

[BaseChain](BaseChain.md).[constructor](BaseChain.md#constructor)

#### Defined in

[langchain/src/chains/conversational_retrieval_chain.ts:62](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/conversational_retrieval_chain.ts#L62)

## Properties

### chatHistoryKey

> **chatHistoryKey**: `string` = `"chat_history"`

#### Defined in

[langchain/src/chains/conversational_retrieval_chain.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/conversational_retrieval_chain.ts#L42)

### combineDocumentsChain

> **combineDocumentsChain**: [`BaseChain`](BaseChain.md)

#### Implementation of

[ConversationalRetrievalQAChainInput](../interfaces/ConversationalRetrievalQAChainInput.md).[combineDocumentsChain](../interfaces/ConversationalRetrievalQAChainInput.md#combinedocumentschain)

#### Defined in

[langchain/src/chains/conversational_retrieval_chain.ts:56](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/conversational_retrieval_chain.ts#L56)

### inputKey

> **inputKey**: `string` = `"question"`

#### Implementation of

[ConversationalRetrievalQAChainInput](../interfaces/ConversationalRetrievalQAChainInput.md).[inputKey](../interfaces/ConversationalRetrievalQAChainInput.md#inputkey)

#### Defined in

[langchain/src/chains/conversational_retrieval_chain.ts:40](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/conversational_retrieval_chain.ts#L40)

### questionGeneratorChain

> **questionGeneratorChain**: [`LLMChain`](LLMChain.md)

#### Implementation of

[ConversationalRetrievalQAChainInput](../interfaces/ConversationalRetrievalQAChainInput.md).[questionGeneratorChain](../interfaces/ConversationalRetrievalQAChainInput.md#questiongeneratorchain)

#### Defined in

[langchain/src/chains/conversational_retrieval_chain.ts:58](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/conversational_retrieval_chain.ts#L58)

### retriever

> **retriever**: [`BaseRetriever`](../../schema/classes/BaseRetriever.md)

#### Implementation of

[ConversationalRetrievalQAChainInput](../interfaces/ConversationalRetrievalQAChainInput.md).[retriever](../interfaces/ConversationalRetrievalQAChainInput.md#retriever)

#### Defined in

[langchain/src/chains/conversational_retrieval_chain.ts:54](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/conversational_retrieval_chain.ts#L54)

### returnSourceDocuments

> **returnSourceDocuments**: `boolean` = `false`

#### Implementation of

[ConversationalRetrievalQAChainInput](../interfaces/ConversationalRetrievalQAChainInput.md).[returnSourceDocuments](../interfaces/ConversationalRetrievalQAChainInput.md#returnsourcedocuments)

#### Defined in

[langchain/src/chains/conversational_retrieval_chain.ts:60](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/conversational_retrieval_chain.ts#L60)

### verbose

> **verbose**: `boolean`

Whether to print out response text.

#### Implementation of

[ConversationalRetrievalQAChainInput](../interfaces/ConversationalRetrievalQAChainInput.md).[verbose](../interfaces/ConversationalRetrievalQAChainInput.md#verbose)

#### Inherited from

[BaseChain](BaseChain.md).[verbose](BaseChain.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L27)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Implementation of

[ConversationalRetrievalQAChainInput](../interfaces/ConversationalRetrievalQAChainInput.md).[callbacks](../interfaces/ConversationalRetrievalQAChainInput.md#callbacks)

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

[langchain/src/chains/conversational_retrieval_chain.ts:44](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/conversational_retrieval_chain.ts#L44)

#### Overrides

[BaseChain](BaseChain.md).[inputKeys](BaseChain.md#inputkeys)

#### Defined in

[langchain/src/chains/conversational_retrieval_chain.ts:44](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/conversational_retrieval_chain.ts#L44)

### outputKeys

> **outputKeys**(): `string`[]

#### Returns

`string`[]

#### Overrides

BaseChain.outputKeys

#### Defined in

[langchain/src/chains/conversational_retrieval_chain.ts:48](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/conversational_retrieval_chain.ts#L48)

#### Overrides

[BaseChain](BaseChain.md).[outputKeys](BaseChain.md#outputkeys)

#### Defined in

[langchain/src/chains/conversational_retrieval_chain.ts:48](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/conversational_retrieval_chain.ts#L48)

## Methods

### \_chainType()

Return the string type key uniquely identifying this class of chain.

> **\_chainType**(): `string`

#### Returns

`string`

#### Overrides

[BaseChain](BaseChain.md).[\_chainType](BaseChain.md#_chaintype)

#### Defined in

[langchain/src/chains/conversational_retrieval_chain.ts:122](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/conversational_retrieval_chain.ts#L122)

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

> **serialize**(): [`SerializedChatVectorDBQAChain`](../types/SerializedChatVectorDBQAChain.md)

#### Returns

[`SerializedChatVectorDBQAChain`](../types/SerializedChatVectorDBQAChain.md)

#### Overrides

[BaseChain](BaseChain.md).[serialize](BaseChain.md#serialize)

#### Defined in

[langchain/src/chains/conversational_retrieval_chain.ts:133](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/conversational_retrieval_chain.ts#L133)

### deserialize()

Load a chain from a json-like object describing it.

> `Static` **deserialize**(`_data`: [`SerializedChatVectorDBQAChain`](../types/SerializedChatVectorDBQAChain.md), `_values`: `LoadValues`): `Promise`<[`ConversationalRetrievalQAChain`](ConversationalRetrievalQAChain.md)\>

#### Parameters

| Parameter | Type                                                                         |
| :-------- | :--------------------------------------------------------------------------- |
| `_data`   | [`SerializedChatVectorDBQAChain`](../types/SerializedChatVectorDBQAChain.md) |
| `_values` | `LoadValues`                                                                 |

#### Returns

`Promise`<[`ConversationalRetrievalQAChain`](ConversationalRetrievalQAChain.md)\>

#### Overrides

[BaseChain](BaseChain.md).[deserialize](BaseChain.md#deserialize)

#### Defined in

[langchain/src/chains/conversational_retrieval_chain.ts:126](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/conversational_retrieval_chain.ts#L126)

### fromLLM()

> `Static` **fromLLM**(`llm`: [`BaseLLM`](../../llms_base/classes/BaseLLM.md), `retriever`: [`BaseRetriever`](../../schema/classes/BaseRetriever.md), `options`: `object` = `{}`): [`ConversationalRetrievalQAChain`](ConversationalRetrievalQAChain.md)

#### Parameters

| Parameter                            | Type                                                     |
| :----------------------------------- | :------------------------------------------------------- |
| `llm`                                | [`BaseLLM`](../../llms_base/classes/BaseLLM.md)          |
| `retriever`                          | [`BaseRetriever`](../../schema/classes/BaseRetriever.md) |
| `options`                            | `object`                                                 |
| `options.inputKey?`                  | `string`                                                 |
| `options.outputKey?`                 | `string`                                                 |
| `options.qaTemplate?`                | `string`                                                 |
| `options.questionGeneratorTemplate?` | `string`                                                 |
| `options.returnSourceDocuments?`     | `boolean`                                                |

#### Returns

[`ConversationalRetrievalQAChain`](ConversationalRetrievalQAChain.md)

#### Defined in

[langchain/src/chains/conversational_retrieval_chain.ts:137](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/conversational_retrieval_chain.ts#L137)
