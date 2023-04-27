---
title: "RefineDocumentsChain"
---

# RefineDocumentsChain

Combine documents by doing a first pass and then refining on more documents.

## Hierarchy

- [`BaseChain`](BaseChain.md).**RefineDocumentsChain**

## Implements

- [`RefineDocumentsChainInput`](../interfaces/RefineDocumentsChainInput.md)

## Constructors

### constructor()

> **new RefineDocumentsChain**(`fields`: [`RefineDocumentsChainInput`](../interfaces/RefineDocumentsChainInput.md)): [`RefineDocumentsChain`](RefineDocumentsChain.md)

#### Parameters

| Parameter | Type                                                                      |
| :-------- | :------------------------------------------------------------------------ |
| `fields`  | [`RefineDocumentsChainInput`](../interfaces/RefineDocumentsChainInput.md) |

#### Returns

[`RefineDocumentsChain`](RefineDocumentsChain.md)

#### Overrides

[BaseChain](BaseChain.md).[constructor](BaseChain.md#constructor)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:274](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L274)

## Properties

### documentPrompt

> **documentPrompt**: [`BasePromptTemplate`](../../prompts/classes/BasePromptTemplate.md)

#### Implementation of

[RefineDocumentsChainInput](../interfaces/RefineDocumentsChainInput.md).[documentPrompt](../interfaces/RefineDocumentsChainInput.md#documentprompt)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:264](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L264)

### documentVariableName

> **documentVariableName**: `string` = `"context"`

Variable name in the LLM chain to put the documents in

#### Implementation of

[RefineDocumentsChainInput](../interfaces/RefineDocumentsChainInput.md).[documentVariableName](../interfaces/RefineDocumentsChainInput.md#documentvariablename)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:251](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L251)

### initialResponseName

> **initialResponseName**: `string` = `"existing_answer"`

#### Implementation of

[RefineDocumentsChainInput](../interfaces/RefineDocumentsChainInput.md).[initialResponseName](../interfaces/RefineDocumentsChainInput.md#initialresponsename)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:253](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L253)

### inputKey

> **inputKey**: `string` = `"input_documents"`

#### Implementation of

[RefineDocumentsChainInput](../interfaces/RefineDocumentsChainInput.md).[inputKey](../interfaces/RefineDocumentsChainInput.md#inputkey)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:247](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L247)

### llmChain

> **llmChain**: [`LLMChain`](LLMChain.md)

LLM Wrapper to use after formatting documents

#### Implementation of

[RefineDocumentsChainInput](../interfaces/RefineDocumentsChainInput.md).[llmChain](../interfaces/RefineDocumentsChainInput.md#llmchain)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:245](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L245)

### outputKey

> **outputKey**: `string` = `"output_text"`

#### Implementation of

[RefineDocumentsChainInput](../interfaces/RefineDocumentsChainInput.md).[outputKey](../interfaces/RefineDocumentsChainInput.md#outputkey)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:249](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L249)

### refineLLMChain

> **refineLLMChain**: [`LLMChain`](LLMChain.md)

#### Implementation of

[RefineDocumentsChainInput](../interfaces/RefineDocumentsChainInput.md).[refineLLMChain](../interfaces/RefineDocumentsChainInput.md#refinellmchain)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:255](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L255)

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

### defaultDocumentPrompt

> **defaultDocumentPrompt**(): [`BasePromptTemplate`](../../prompts/classes/BasePromptTemplate.md)

#### Returns

[`BasePromptTemplate`](../../prompts/classes/BasePromptTemplate.md)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:257](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L257)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:257](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L257)

### inputKeys

> **inputKeys**(): `string`[]

#### Returns

`string`[]

#### Overrides

BaseChain.inputKeys

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:266](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L266)

#### Overrides

[BaseChain](BaseChain.md).[inputKeys](BaseChain.md#inputkeys)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:266](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L266)

### outputKeys

> **outputKeys**(): `string`[]

#### Returns

`string`[]

#### Overrides

BaseChain.outputKeys

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:270](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L270)

#### Overrides

[BaseChain](BaseChain.md).[outputKeys](BaseChain.md#outputkeys)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:270](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L270)

## Methods

### \_chainType()

Return the string type key uniquely identifying this class of chain.

> **\_chainType**(): "refine_documents_chain"

#### Returns

"refine_documents_chain"

#### Overrides

[BaseChain](BaseChain.md).[\_chainType](BaseChain.md#_chaintype)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:365](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L365)

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

> **serialize**(): [`SerializedRefineDocumentsChain`](../types/SerializedRefineDocumentsChain.md)

#### Returns

[`SerializedRefineDocumentsChain`](../types/SerializedRefineDocumentsChain.md)

#### Overrides

[BaseChain](BaseChain.md).[serialize](BaseChain.md#serialize)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:388](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L388)

### deserialize()

Load a chain from a json-like object describing it.

> `Static` **deserialize**(`data`: [`SerializedRefineDocumentsChain`](../types/SerializedRefineDocumentsChain.md)): `Promise`<[`RefineDocumentsChain`](RefineDocumentsChain.md)\>

#### Parameters

| Parameter | Type                                                                           |
| :-------- | :----------------------------------------------------------------------------- |
| `data`    | [`SerializedRefineDocumentsChain`](../types/SerializedRefineDocumentsChain.md) |

#### Returns

`Promise`<[`RefineDocumentsChain`](RefineDocumentsChain.md)\>

#### Overrides

[BaseChain](BaseChain.md).[deserialize](BaseChain.md#deserialize)

#### Defined in

[langchain/src/chains/combine_docs_chain.ts:369](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/combine_docs_chain.ts#L369)
