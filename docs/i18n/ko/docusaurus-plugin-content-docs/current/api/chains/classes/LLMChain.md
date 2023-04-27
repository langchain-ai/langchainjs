---
title: "LLMChain"
---

# LLMChain

Chain to run queries against LLMs.

## Example

```ts
import { LLMChain } from "langchain/chains";
import { OpenAI } from "langchain/llms/openai";
import { PromptTemplate } from "langchain/prompts";

const prompt = PromptTemplate.fromTemplate("Tell me a {adjective} joke");
const llm = new LLMChain({ llm: new OpenAI(), prompt });
```

## Hierarchy

- [`BaseChain`](BaseChain.md).**LLMChain**

## Implements

- [`LLMChainInput`](../interfaces/LLMChainInput.md)

## Constructors

### constructor()

> **new LLMChain**(`fields`: [`LLMChainInput`](../interfaces/LLMChainInput.md)): [`LLMChain`](LLMChain.md)

#### Parameters

| Parameter | Type                                              |
| :-------- | :------------------------------------------------ |
| `fields`  | [`LLMChainInput`](../interfaces/LLMChainInput.md) |

#### Returns

[`LLMChain`](LLMChain.md)

#### Overrides

[BaseChain](BaseChain.md).[constructor](BaseChain.md#constructor)

#### Defined in

[langchain/src/chains/llm_chain.ts:51](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/llm_chain.ts#L51)

## Properties

### llm

> **llm**: [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md)

LLM Wrapper to use

#### Implementation of

[LLMChainInput](../interfaces/LLMChainInput.md).[llm](../interfaces/LLMChainInput.md#llm)

#### Defined in

[langchain/src/chains/llm_chain.ts:37](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/llm_chain.ts#L37)

### outputKey

> **outputKey**: `string` = `"text"`

Key to use for output, defaults to `text`

#### Implementation of

[LLMChainInput](../interfaces/LLMChainInput.md).[outputKey](../interfaces/LLMChainInput.md#outputkey)

#### Defined in

[langchain/src/chains/llm_chain.ts:39](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/llm_chain.ts#L39)

### prompt

> **prompt**: [`BasePromptTemplate`](../../prompts/classes/BasePromptTemplate.md)

Prompt object to use

#### Implementation of

[LLMChainInput](../interfaces/LLMChainInput.md).[prompt](../interfaces/LLMChainInput.md#prompt)

#### Defined in

[langchain/src/chains/llm_chain.ts:35](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/llm_chain.ts#L35)

### verbose

> **verbose**: `boolean`

Whether to print out response text.

#### Implementation of

[LLMChainInput](../interfaces/LLMChainInput.md).[verbose](../interfaces/LLMChainInput.md#verbose)

#### Inherited from

[BaseChain](BaseChain.md).[verbose](BaseChain.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L27)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Implementation of

[LLMChainInput](../interfaces/LLMChainInput.md).[callbacks](../interfaces/LLMChainInput.md#callbacks)

#### Inherited from

[BaseChain](BaseChain.md).[callbacks](BaseChain.md#callbacks)

#### Defined in

[langchain/src/base_language/index.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L29)

### memory?

> **memory**: [`BaseMemory`](../../memory/classes/BaseMemory.md)

#### Implementation of

[LLMChainInput](../interfaces/LLMChainInput.md).[memory](../interfaces/LLMChainInput.md#memory)

#### Inherited from

[BaseChain](BaseChain.md).[memory](BaseChain.md#memory)

#### Defined in

[langchain/src/chains/base.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L27)

### outputParser?

> **outputParser**: `BaseOutputParser`<`unknown`\>

OutputParser to use

#### Implementation of

[LLMChainInput](../interfaces/LLMChainInput.md).[outputParser](../interfaces/LLMChainInput.md#outputparser)

#### Defined in

[langchain/src/chains/llm_chain.ts:41](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/llm_chain.ts#L41)

## Accessors

### inputKeys

> **inputKeys**(): `string`[]

#### Returns

`string`[]

#### Overrides

BaseChain.inputKeys

#### Defined in

[langchain/src/chains/llm_chain.ts:43](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/llm_chain.ts#L43)

#### Overrides

[BaseChain](BaseChain.md).[inputKeys](BaseChain.md#inputkeys)

#### Defined in

[langchain/src/chains/llm_chain.ts:43](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/llm_chain.ts#L43)

### outputKeys

> **outputKeys**(): `string`[]

#### Returns

`string`[]

#### Overrides

BaseChain.outputKeys

#### Defined in

[langchain/src/chains/llm_chain.ts:47](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/llm_chain.ts#L47)

#### Overrides

[BaseChain](BaseChain.md).[outputKeys](BaseChain.md#outputkeys)

#### Defined in

[langchain/src/chains/llm_chain.ts:47](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/llm_chain.ts#L47)

## Methods

### \_chainType()

Return the string type key uniquely identifying this class of chain.

> **\_chainType**(): "llm_chain"

#### Returns

"llm_chain"

#### Overrides

[BaseChain](BaseChain.md).[\_chainType](BaseChain.md#_chaintype)

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

[BaseChain](BaseChain.md).[run](BaseChain.md#run)

#### Defined in

[langchain/src/chains/base.ts:56](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L56)

### serialize()

Return a json-like object representing this chain.

> **serialize**(): [`SerializedLLMChain`](../types/SerializedLLMChain.md)

#### Returns

[`SerializedLLMChain`](../types/SerializedLLMChain.md)

#### Overrides

[BaseChain](BaseChain.md).[serialize](BaseChain.md#serialize)

#### Defined in

[langchain/src/chains/llm_chain.ts:152](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/llm_chain.ts#L152)

### deserialize()

Load a chain from a json-like object describing it.

> `Static` **deserialize**(`data`: [`SerializedLLMChain`](../types/SerializedLLMChain.md)): `Promise`<[`LLMChain`](LLMChain.md)\>

#### Parameters

| Parameter | Type                                                   |
| :-------- | :----------------------------------------------------- |
| `data`    | [`SerializedLLMChain`](../types/SerializedLLMChain.md) |

#### Returns

`Promise`<[`LLMChain`](LLMChain.md)\>

#### Overrides

[BaseChain](BaseChain.md).[deserialize](BaseChain.md#deserialize)

#### Defined in

[langchain/src/chains/llm_chain.ts:137](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/llm_chain.ts#L137)
