---
title: "TaskPrioritizationChain"
---

# TaskPrioritizationChain

Chain to prioritize tasks.

## Hierarchy

- [`LLMChain`](../../chains/classes/LLMChain.md).**TaskPrioritizationChain**

## Constructors

### constructor()

> **new TaskPrioritizationChain**(`fields`: [`LLMChainInput`](../../chains/interfaces/LLMChainInput.md)): [`TaskPrioritizationChain`](TaskPrioritizationChain.md)

#### Parameters

| Parameter | Type                                                        |
| :-------- | :---------------------------------------------------------- |
| `fields`  | [`LLMChainInput`](../../chains/interfaces/LLMChainInput.md) |

#### Returns

[`TaskPrioritizationChain`](TaskPrioritizationChain.md)

#### Inherited from

[LLMChain](../../chains/classes/LLMChain.md).[constructor](../../chains/classes/LLMChain.md#constructor)

#### Defined in

[langchain/src/chains/llm_chain.ts:51](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/llm_chain.ts#L51)

## Properties

### llm

> **llm**: [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md)

LLM Wrapper to use

#### Inherited from

[LLMChain](../../chains/classes/LLMChain.md).[llm](../../chains/classes/LLMChain.md#llm)

#### Defined in

[langchain/src/chains/llm_chain.ts:37](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/llm_chain.ts#L37)

### outputKey

> **outputKey**: `string` = `"text"`

Key to use for output, defaults to `text`

#### Inherited from

[LLMChain](../../chains/classes/LLMChain.md).[outputKey](../../chains/classes/LLMChain.md#outputkey)

#### Defined in

[langchain/src/chains/llm_chain.ts:39](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/llm_chain.ts#L39)

### prompt

> **prompt**: [`BasePromptTemplate`](../../prompts/classes/BasePromptTemplate.md)

Prompt object to use

#### Inherited from

[LLMChain](../../chains/classes/LLMChain.md).[prompt](../../chains/classes/LLMChain.md#prompt)

#### Defined in

[langchain/src/chains/llm_chain.ts:35](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/llm_chain.ts#L35)

### verbose

> **verbose**: `boolean`

Whether to print out response text.

#### Inherited from

[LLMChain](../../chains/classes/LLMChain.md).[verbose](../../chains/classes/LLMChain.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L27)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Inherited from

[LLMChain](../../chains/classes/LLMChain.md).[callbacks](../../chains/classes/LLMChain.md#callbacks)

#### Defined in

[langchain/src/base_language/index.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L29)

### memory?

> **memory**: [`BaseMemory`](../../memory/classes/BaseMemory.md)

#### Inherited from

[LLMChain](../../chains/classes/LLMChain.md).[memory](../../chains/classes/LLMChain.md#memory)

#### Defined in

[langchain/src/chains/base.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L27)

### outputParser?

> **outputParser**: `BaseOutputParser`<`unknown`\>

OutputParser to use

#### Inherited from

[LLMChain](../../chains/classes/LLMChain.md).[outputParser](../../chains/classes/LLMChain.md#outputparser)

#### Defined in

[langchain/src/chains/llm_chain.ts:41](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/llm_chain.ts#L41)

## Accessors

### inputKeys

> **inputKeys**(): `string`[]

#### Returns

`string`[]

#### Inherited from

LLMChain.inputKeys

#### Defined in

[langchain/src/chains/llm_chain.ts:43](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/llm_chain.ts#L43)

#### Inherited from

[LLMChain](../../chains/classes/LLMChain.md).[inputKeys](../../chains/classes/LLMChain.md#inputkeys)

#### Defined in

[langchain/src/chains/llm_chain.ts:43](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/llm_chain.ts#L43)

### outputKeys

> **outputKeys**(): `string`[]

#### Returns

`string`[]

#### Inherited from

LLMChain.outputKeys

#### Defined in

[langchain/src/chains/llm_chain.ts:47](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/llm_chain.ts#L47)

#### Inherited from

[LLMChain](../../chains/classes/LLMChain.md).[outputKeys](../../chains/classes/LLMChain.md#outputkeys)

#### Defined in

[langchain/src/chains/llm_chain.ts:47](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/llm_chain.ts#L47)

## Methods

### \_chainType()

Return the string type key uniquely identifying this class of chain.

> **\_chainType**(): "llm_chain"

#### Returns

"llm_chain"

#### Inherited from

[LLMChain](../../chains/classes/LLMChain.md).[\_chainType](../../chains/classes/LLMChain.md#_chaintype)

#### Defined in

[langchain/src/chains/llm_chain.ts:133](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/llm_chain.ts#L133)

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

[LLMChain](../../chains/classes/LLMChain.md).[apply](../../chains/classes/LLMChain.md#apply)

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

[LLMChain](../../chains/classes/LLMChain.md).[call](../../chains/classes/LLMChain.md#call)

#### Defined in

[langchain/src/chains/base.ts:84](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L84)

### predict()

Format prompt with values and pass to LLM

#### Example

```ts
llm.predict({ adjective: "funny" });
```

> **predict**(`values`: [`ChainValues`](../../schema/types/ChainValues.md), `callbackManager`?: [`CallbackManager`](../../callbacks/classes/CallbackManager.md)): `Promise`<`string`\>

#### Parameters

| Parameter          | Type                                                            | Description                     |
| :----------------- | :-------------------------------------------------------------- | :------------------------------ |
| `values`           | [`ChainValues`](../../schema/types/ChainValues.md)              | keys to pass to prompt template |
| `callbackManager?` | [`CallbackManager`](../../callbacks/classes/CallbackManager.md) | CallbackManager to use          |

#### Returns

`Promise`<`string`\>

Completion from LLM.

#### Inherited from

[LLMChain](../../chains/classes/LLMChain.md).[predict](../../chains/classes/LLMChain.md#predict)

#### Defined in

[langchain/src/chains/llm_chain.ts:125](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/llm_chain.ts#L125)

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

[LLMChain](../../chains/classes/LLMChain.md).[run](../../chains/classes/LLMChain.md#run)

#### Defined in

[langchain/src/chains/base.ts:56](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L56)

### serialize()

Return a json-like object representing this chain.

> **serialize**(): [`SerializedLLMChain`](../../chains/types/SerializedLLMChain.md)

#### Returns

[`SerializedLLMChain`](../../chains/types/SerializedLLMChain.md)

#### Inherited from

[LLMChain](../../chains/classes/LLMChain.md).[serialize](../../chains/classes/LLMChain.md#serialize)

#### Defined in

[langchain/src/chains/llm_chain.ts:152](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/llm_chain.ts#L152)

### deserialize()

Load a chain from a json-like object describing it.

> `Static` **deserialize**(`data`: [`SerializedLLMChain`](../../chains/types/SerializedLLMChain.md)): `Promise`<[`LLMChain`](../../chains/classes/LLMChain.md)\>

#### Parameters

| Parameter | Type                                                             |
| :-------- | :--------------------------------------------------------------- |
| `data`    | [`SerializedLLMChain`](../../chains/types/SerializedLLMChain.md) |

#### Returns

`Promise`<[`LLMChain`](../../chains/classes/LLMChain.md)\>

#### Inherited from

[LLMChain](../../chains/classes/LLMChain.md).[deserialize](../../chains/classes/LLMChain.md#deserialize)

#### Defined in

[langchain/src/chains/llm_chain.ts:137](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/llm_chain.ts#L137)

### fromLLM()

> `Static` **fromLLM**(`fields`: `Omit`<[`LLMChainInput`](../../chains/interfaces/LLMChainInput.md), "prompt"\>): [`LLMChain`](../../chains/classes/LLMChain.md)

#### Parameters

| Parameter | Type                                                                            |
| :-------- | :------------------------------------------------------------------------------ |
| `fields`  | `Omit`<[`LLMChainInput`](../../chains/interfaces/LLMChainInput.md), "prompt"\> |

#### Returns

[`LLMChain`](../../chains/classes/LLMChain.md)

#### Defined in

[langchain/src/experimental/babyagi/task_prioritization.ts:6](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/babyagi/task_prioritization.ts#L6)
