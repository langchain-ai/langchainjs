---
title: "BaseChain"
---

# BaseChain

Base interface that all chains must implement.

## Hierarchy

- [`BaseLangChain`](../../base_language/classes/BaseLangChain.md).**BaseChain**

## Implements

- [`ChainInputs`](../interfaces/ChainInputs.md)

## Constructors

### constructor()

> **new BaseChain**(`memory`?: [`BaseMemory`](../../memory/classes/BaseMemory.md), `verbose`?: `boolean`, `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): [`BaseChain`](BaseChain.md)

#### Parameters

| Parameter    | Type                                               |
| :----------- | :------------------------------------------------- |
| `memory?`    | [`BaseMemory`](../../memory/classes/BaseMemory.md) |
| `verbose?`   | `boolean`                                          |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md)  |

#### Returns

[`BaseChain`](BaseChain.md)

#### Overrides

[BaseLangChain](../../base_language/classes/BaseLangChain.md).[constructor](../../base_language/classes/BaseLangChain.md#constructor)

#### Defined in

[langchain/src/chains/base.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L29)

## Properties

### verbose

> **verbose**: `boolean`

Whether to print out response text.

#### Implementation of

[ChainInputs](../interfaces/ChainInputs.md).[verbose](../interfaces/ChainInputs.md#verbose)

#### Inherited from

[BaseLangChain](../../base_language/classes/BaseLangChain.md).[verbose](../../base_language/classes/BaseLangChain.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L27)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Implementation of

[ChainInputs](../interfaces/ChainInputs.md).[callbacks](../interfaces/ChainInputs.md#callbacks)

#### Inherited from

[BaseLangChain](../../base_language/classes/BaseLangChain.md).[callbacks](../../base_language/classes/BaseLangChain.md#callbacks)

#### Defined in

[langchain/src/base_language/index.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L29)

### memory?

> **memory**: [`BaseMemory`](../../memory/classes/BaseMemory.md)

#### Implementation of

[ChainInputs](../interfaces/ChainInputs.md).[memory](../interfaces/ChainInputs.md#memory)

#### Defined in

[langchain/src/chains/base.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L27)

## Accessors

### inputKeys

> `Abstract` **inputKeys**(): `string`[]

#### Returns

`string`[]

#### Defined in

[langchain/src/chains/base.ts:52](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L52)

#### Defined in

[langchain/src/chains/base.ts:52](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L52)

### outputKeys

> `Abstract` **outputKeys**(): `string`[]

#### Returns

`string`[]

#### Defined in

[langchain/src/chains/base.ts:54](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L54)

#### Defined in

[langchain/src/chains/base.ts:54](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L54)

## Methods

### \_call()

Run the core logic of this chain and return the output

> `Abstract` **\_call**(`values`: [`ChainValues`](../../schema/types/ChainValues.md), `runManager`?: [`CallbackManagerForChainRun`](../../callbacks/classes/CallbackManagerForChainRun.md)): `Promise`<[`ChainValues`](../../schema/types/ChainValues.md)\>

#### Parameters

| Parameter     | Type                                                                                  |
| :------------ | :------------------------------------------------------------------------------------ |
| `values`      | [`ChainValues`](../../schema/types/ChainValues.md)                                    |
| `runManager?` | [`CallbackManagerForChainRun`](../../callbacks/classes/CallbackManagerForChainRun.md) |

#### Returns

`Promise`<[`ChainValues`](../../schema/types/ChainValues.md)\>

#### Defined in

[langchain/src/chains/base.ts:37](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L37)

### \_chainType()

Return the string type key uniquely identifying this class of chain.

> `Abstract` **\_chainType**(): `string`

#### Returns

`string`

#### Defined in

[langchain/src/chains/base.ts:45](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L45)

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

#### Defined in

[langchain/src/chains/base.ts:56](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L56)

### serialize()

Return a json-like object representing this chain.

> `Abstract` **serialize**(): [`SerializedBaseChain`](../types/SerializedBaseChain.md)

#### Returns

[`SerializedBaseChain`](../types/SerializedBaseChain.md)

#### Defined in

[langchain/src/chains/base.ts:50](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L50)

### deserialize()

Load a chain from a json-like object describing it.

> `Static` **deserialize**(`data`: [`SerializedBaseChain`](../types/SerializedBaseChain.md), `values`: `LoadValues` = `{}`): `Promise`<[`BaseChain`](BaseChain.md)\>

#### Parameters

| Parameter | Type                                                     |
| :-------- | :------------------------------------------------------- |
| `data`    | [`SerializedBaseChain`](../types/SerializedBaseChain.md) |
| `values`  | `LoadValues`                                             |

#### Returns

`Promise`<[`BaseChain`](BaseChain.md)\>

#### Defined in

[langchain/src/chains/base.ts:135](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L135)
