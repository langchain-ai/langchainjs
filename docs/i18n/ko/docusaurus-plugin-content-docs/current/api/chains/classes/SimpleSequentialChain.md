---
title: "SimpleSequentialChain"
---

# SimpleSequentialChain

Simple chain where a single string output of one chain is fed directly into the next.

## Example

```ts
import { SimpleSequentialChain, LLMChain } from "langchain/chains";
import { OpenAI } from "langchain/llms/openai";
import { PromptTemplate } from "langchain/prompts";

// This is an LLMChain to write a synopsis given a title of a play.
const llm = new OpenAI({ temperature: 0 });
const template = `You are a playwright. Given the title of play, it is your job to write a synopsis for that title.

Title: {title}
Playwright: This is a synopsis for the above play:`;
const promptTemplate = new PromptTemplate({
  template,
  inputVariables: ["title"],
});
const synopsisChain = new LLMChain({ llm, prompt: promptTemplate });

// This is an LLMChain to write a review of a play given a synopsis.
const reviewLLM = new OpenAI({ temperature: 0 });
const reviewTemplate = `You are a play critic from the New York Times. Given the synopsis of play, it is your job to write a review for that play.

Play Synopsis:
{synopsis}
Review from a New York Times play critic of the above play:`;
const reviewPromptTempalte = new PromptTemplate({
  template: reviewTemplate,
  inputVariables: ["synopsis"],
});
const reviewChain = new LLMChain({
  llm: reviewLLM,
  prompt: reviewPromptTempalte,
});

const overallChain = new SimpleSequentialChain({
  chains: [synopsisChain, reviewChain],
  verbose: true,
});
const review = await overallChain.run("Tragedy at sunset on the beach");
// the variable review contains resulting play review.
```

## Hierarchy

- [`BaseChain`](BaseChain.md).**SimpleSequentialChain**

## Implements

- [`SimpleSequentialChainInput`](../interfaces/SimpleSequentialChainInput.md)

## Constructors

### constructor()

> **new SimpleSequentialChain**(`fields`: [`SimpleSequentialChainInput`](../interfaces/SimpleSequentialChainInput.md)): [`SimpleSequentialChain`](SimpleSequentialChain.md)

#### Parameters

| Parameter | Type                                                                        |
| :-------- | :-------------------------------------------------------------------------- |
| `fields`  | [`SimpleSequentialChainInput`](../interfaces/SimpleSequentialChainInput.md) |

#### Returns

[`SimpleSequentialChain`](SimpleSequentialChain.md)

#### Overrides

[BaseChain](BaseChain.md).[constructor](BaseChain.md#constructor)

#### Defined in

[langchain/src/chains/sequential_chain.ts:241](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sequential_chain.ts#L241)

## Properties

### chains

> **chains**: [`BaseChain`](BaseChain.md)[]

Array of chains to run as a sequence. The chains are run in order they appear in the array.

#### Implementation of

[SimpleSequentialChainInput](../interfaces/SimpleSequentialChainInput.md).[chains](../interfaces/SimpleSequentialChainInput.md#chains)

#### Defined in

[langchain/src/chains/sequential_chain.ts:225](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sequential_chain.ts#L225)

### inputKey

> **inputKey**: `string` = `"input"`

#### Defined in

[langchain/src/chains/sequential_chain.ts:227](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sequential_chain.ts#L227)

### outputKey

> **outputKey**: `string` = `"output"`

#### Defined in

[langchain/src/chains/sequential_chain.ts:229](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sequential_chain.ts#L229)

### trimOutputs

> **trimOutputs**: `boolean`

Whether or not to trim the intermediate outputs.

#### Implementation of

[SimpleSequentialChainInput](../interfaces/SimpleSequentialChainInput.md).[trimOutputs](../interfaces/SimpleSequentialChainInput.md#trimoutputs)

#### Defined in

[langchain/src/chains/sequential_chain.ts:231](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sequential_chain.ts#L231)

### verbose

> **verbose**: `boolean`

Whether to print out response text.

#### Implementation of

[SimpleSequentialChainInput](../interfaces/SimpleSequentialChainInput.md).[verbose](../interfaces/SimpleSequentialChainInput.md#verbose)

#### Inherited from

[BaseChain](BaseChain.md).[verbose](BaseChain.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L27)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Implementation of

[SimpleSequentialChainInput](../interfaces/SimpleSequentialChainInput.md).[callbacks](../interfaces/SimpleSequentialChainInput.md#callbacks)

#### Inherited from

[BaseChain](BaseChain.md).[callbacks](BaseChain.md#callbacks)

#### Defined in

[langchain/src/base_language/index.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L29)

### memory?

> **memory**: [`BaseMemory`](../../memory/classes/BaseMemory.md)

#### Implementation of

[SimpleSequentialChainInput](../interfaces/SimpleSequentialChainInput.md).[memory](../interfaces/SimpleSequentialChainInput.md#memory)

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

[langchain/src/chains/sequential_chain.ts:233](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sequential_chain.ts#L233)

#### Overrides

[BaseChain](BaseChain.md).[inputKeys](BaseChain.md#inputkeys)

#### Defined in

[langchain/src/chains/sequential_chain.ts:233](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sequential_chain.ts#L233)

### outputKeys

> **outputKeys**(): `string`[]

#### Returns

`string`[]

#### Overrides

BaseChain.outputKeys

#### Defined in

[langchain/src/chains/sequential_chain.ts:237](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sequential_chain.ts#L237)

#### Overrides

[BaseChain](BaseChain.md).[outputKeys](BaseChain.md#outputkeys)

#### Defined in

[langchain/src/chains/sequential_chain.ts:237](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sequential_chain.ts#L237)

## Methods

### \_chainType()

Return the string type key uniquely identifying this class of chain.

> **\_chainType**(): "simple_sequential_chain"

#### Returns

"simple_sequential_chain"

#### Overrides

[BaseChain](BaseChain.md).[\_chainType](BaseChain.md#_chaintype)

#### Defined in

[langchain/src/chains/sequential_chain.ts:288](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sequential_chain.ts#L288)

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

> **serialize**(): [`SerializedSimpleSequentialChain`](../types/SerializedSimpleSequentialChain.md)

#### Returns

[`SerializedSimpleSequentialChain`](../types/SerializedSimpleSequentialChain.md)

#### Overrides

[BaseChain](BaseChain.md).[serialize](BaseChain.md#serialize)

#### Defined in

[langchain/src/chains/sequential_chain.ts:302](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sequential_chain.ts#L302)

### deserialize()

Load a chain from a json-like object describing it.

> `Static` **deserialize**(`data`: [`SerializedSimpleSequentialChain`](../types/SerializedSimpleSequentialChain.md)): `Promise`<[`SimpleSequentialChain`](SimpleSequentialChain.md)\>

#### Parameters

| Parameter | Type                                                                             |
| :-------- | :------------------------------------------------------------------------------- |
| `data`    | [`SerializedSimpleSequentialChain`](../types/SerializedSimpleSequentialChain.md) |

#### Returns

`Promise`<[`SimpleSequentialChain`](SimpleSequentialChain.md)\>

#### Overrides

[BaseChain](BaseChain.md).[deserialize](BaseChain.md#deserialize)

#### Defined in

[langchain/src/chains/sequential_chain.ts:292](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sequential_chain.ts#L292)
