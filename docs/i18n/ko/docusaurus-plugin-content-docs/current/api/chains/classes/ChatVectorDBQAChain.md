---
title: "ChatVectorDBQAChain"
---

# ChatVectorDBQAChain

Base interface that all chains must implement.

## Hierarchy

- [`BaseChain`](BaseChain.md).**ChatVectorDBQAChain**

## Implements

- [`ChatVectorDBQAChainInput`](../interfaces/ChatVectorDBQAChainInput.md)

## Constructors

### constructor()

> **new ChatVectorDBQAChain**(`fields`: `object`): [`ChatVectorDBQAChain`](ChatVectorDBQAChain.md)

#### Parameters

| Parameter                       | Type                                                            |
| :------------------------------ | :-------------------------------------------------------------- |
| `fields`                        | `object`                                                        |
| `fields.combineDocumentsChain`  | [`BaseChain`](BaseChain.md)                                     |
| `fields.questionGeneratorChain` | [`LLMChain`](LLMChain.md)                                       |
| `fields.vectorstore`            | [`VectorStore`](../../vectorstores_base/classes/VectorStore.md) |
| `fields.inputKey?`              | `string`                                                        |
| `fields.k?`                     | `number`                                                        |
| `fields.outputKey?`             | `string`                                                        |
| `fields.returnSourceDocuments?` | `boolean`                                                       |

#### Returns

[`ChatVectorDBQAChain`](ChatVectorDBQAChain.md)

#### Overrides

[BaseChain](BaseChain.md).[constructor](BaseChain.md#constructor)

#### Defined in

[langchain/src/chains/chat_vector_db_chain.ts:65](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/chat_vector_db_chain.ts#L65)

## Properties

### chatHistoryKey

> **chatHistoryKey**: `string` = `"chat_history"`

#### Defined in

[langchain/src/chains/chat_vector_db_chain.ts:45](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/chat_vector_db_chain.ts#L45)

### combineDocumentsChain

> **combineDocumentsChain**: [`BaseChain`](BaseChain.md)

#### Implementation of

[ChatVectorDBQAChainInput](../interfaces/ChatVectorDBQAChainInput.md).[combineDocumentsChain](../interfaces/ChatVectorDBQAChainInput.md#combinedocumentschain)

#### Defined in

[langchain/src/chains/chat_vector_db_chain.ts:59](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/chat_vector_db_chain.ts#L59)

### inputKey

> **inputKey**: `string` = `"question"`

#### Implementation of

[ChatVectorDBQAChainInput](../interfaces/ChatVectorDBQAChainInput.md).[inputKey](../interfaces/ChatVectorDBQAChainInput.md#inputkey)

#### Defined in

[langchain/src/chains/chat_vector_db_chain.ts:43](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/chat_vector_db_chain.ts#L43)

### k

> **k**: `number` = `4`

#### Implementation of

[ChatVectorDBQAChainInput](../interfaces/ChatVectorDBQAChainInput.md).[k](../interfaces/ChatVectorDBQAChainInput.md#k)

#### Defined in

[langchain/src/chains/chat_vector_db_chain.ts:41](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/chat_vector_db_chain.ts#L41)

### outputKey

> **outputKey**: `string` = `"result"`

#### Implementation of

[ChatVectorDBQAChainInput](../interfaces/ChatVectorDBQAChainInput.md).[outputKey](../interfaces/ChatVectorDBQAChainInput.md#outputkey)

#### Defined in

[langchain/src/chains/chat_vector_db_chain.ts:51](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/chat_vector_db_chain.ts#L51)

### questionGeneratorChain

> **questionGeneratorChain**: [`LLMChain`](LLMChain.md)

#### Implementation of

[ChatVectorDBQAChainInput](../interfaces/ChatVectorDBQAChainInput.md).[questionGeneratorChain](../interfaces/ChatVectorDBQAChainInput.md#questiongeneratorchain)

#### Defined in

[langchain/src/chains/chat_vector_db_chain.ts:61](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/chat_vector_db_chain.ts#L61)

### returnSourceDocuments

> **returnSourceDocuments**: `boolean` = `false`

#### Defined in

[langchain/src/chains/chat_vector_db_chain.ts:63](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/chat_vector_db_chain.ts#L63)

### vectorstore

> **vectorstore**: [`VectorStore`](../../vectorstores_base/classes/VectorStore.md)

#### Implementation of

[ChatVectorDBQAChainInput](../interfaces/ChatVectorDBQAChainInput.md).[vectorstore](../interfaces/ChatVectorDBQAChainInput.md#vectorstore)

#### Defined in

[langchain/src/chains/chat_vector_db_chain.ts:57](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/chat_vector_db_chain.ts#L57)

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

[langchain/src/chains/chat_vector_db_chain.ts:47](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/chat_vector_db_chain.ts#L47)

#### Overrides

[BaseChain](BaseChain.md).[inputKeys](BaseChain.md#inputkeys)

#### Defined in

[langchain/src/chains/chat_vector_db_chain.ts:47](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/chat_vector_db_chain.ts#L47)

### outputKeys

> **outputKeys**(): `string`[]

#### Returns

`string`[]

#### Overrides

BaseChain.outputKeys

#### Defined in

[langchain/src/chains/chat_vector_db_chain.ts:53](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/chat_vector_db_chain.ts#L53)

#### Overrides

[BaseChain](BaseChain.md).[outputKeys](BaseChain.md#outputkeys)

#### Defined in

[langchain/src/chains/chat_vector_db_chain.ts:53](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/chat_vector_db_chain.ts#L53)

## Methods

### \_chainType()

Return the string type key uniquely identifying this class of chain.

> **\_chainType**(): "chat-vector-db"

#### Returns

"chat-vector-db"

#### Overrides

[BaseChain](BaseChain.md).[\_chainType](BaseChain.md#_chaintype)

#### Defined in

[langchain/src/chains/chat_vector_db_chain.ts:136](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/chat_vector_db_chain.ts#L136)

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

[langchain/src/chains/chat_vector_db_chain.ts:163](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/chat_vector_db_chain.ts#L163)

### deserialize()

Load a chain from a json-like object describing it.

> `Static` **deserialize**(`data`: [`SerializedChatVectorDBQAChain`](../types/SerializedChatVectorDBQAChain.md), `values`: `LoadValues`): `Promise`<[`ChatVectorDBQAChain`](ChatVectorDBQAChain.md)\>

#### Parameters

| Parameter | Type                                                                         |
| :-------- | :--------------------------------------------------------------------------- |
| `data`    | [`SerializedChatVectorDBQAChain`](../types/SerializedChatVectorDBQAChain.md) |
| `values`  | `LoadValues`                                                                 |

#### Returns

`Promise`<[`ChatVectorDBQAChain`](ChatVectorDBQAChain.md)\>

#### Overrides

[BaseChain](BaseChain.md).[deserialize](BaseChain.md#deserialize)

#### Defined in

[langchain/src/chains/chat_vector_db_chain.ts:140](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/chat_vector_db_chain.ts#L140)

### fromLLM()

> `Static` **fromLLM**(`llm`: [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md), `vectorstore`: [`VectorStore`](../../vectorstores_base/classes/VectorStore.md), `options`: `object` = `{}`): [`ChatVectorDBQAChain`](ChatVectorDBQAChain.md)

#### Parameters

| Parameter                            | Type                                                                    |
| :----------------------------------- | :---------------------------------------------------------------------- |
| `llm`                                | [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md) |
| `vectorstore`                        | [`VectorStore`](../../vectorstores_base/classes/VectorStore.md)         |
| `options`                            | `object`                                                                |
| `options.inputKey?`                  | `string`                                                                |
| `options.k?`                         | `number`                                                                |
| `options.outputKey?`                 | `string`                                                                |
| `options.qaTemplate?`                | `string`                                                                |
| `options.questionGeneratorTemplate?` | `string`                                                                |
| `options.returnSourceDocuments?`     | `boolean`                                                               |

#### Returns

[`ChatVectorDBQAChain`](ChatVectorDBQAChain.md)

#### Defined in

[langchain/src/chains/chat_vector_db_chain.ts:172](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/chat_vector_db_chain.ts#L172)
