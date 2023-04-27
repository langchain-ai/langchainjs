---
title: "SequentialChain"
---

# SequentialChain

Chain where the outputs of one chain feed directly into next.

## Hierarchy

- [`BaseChain`](BaseChain.md).**SequentialChain**

## Implements

- [`SequentialChainInput`](../interfaces/SequentialChainInput.md)

## Constructors

### constructor()

> **new SequentialChain**(`fields`: [`SequentialChainInput`](../interfaces/SequentialChainInput.md)): [`SequentialChain`](SequentialChain.md)

#### Parameters

| Parameter | Type                                                            |
| :-------- | :-------------------------------------------------------------- |
| `fields`  | [`SequentialChainInput`](../interfaces/SequentialChainInput.md) |

#### Returns

[`SequentialChain`](SequentialChain.md)

#### Overrides

[BaseChain](BaseChain.md).[constructor](BaseChain.md#constructor)

#### Defined in

[langchain/src/chains/sequential_chain.ts:48](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sequential_chain.ts#L48)

## Properties

### chains

> **chains**: [`BaseChain`](BaseChain.md)[]

Array of chains to run as a sequence. The chains are run in order they appear in the array.

#### Implementation of

[SequentialChainInput](../interfaces/SequentialChainInput.md).[chains](../interfaces/SequentialChainInput.md#chains)

#### Defined in

[langchain/src/chains/sequential_chain.ts:32](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sequential_chain.ts#L32)

### inputVariables

> **inputVariables**: `string`[]

Defines which variables should be passed as initial input to the first chain.

#### Implementation of

[SequentialChainInput](../interfaces/SequentialChainInput.md).[inputVariables](../interfaces/SequentialChainInput.md#inputvariables)

#### Defined in

[langchain/src/chains/sequential_chain.ts:34](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sequential_chain.ts#L34)

### outputVariables

> **outputVariables**: `string`[]

Which variables should be returned as a result of executing the chain. If not specified, output of the last of the chains is used.

#### Implementation of

[SequentialChainInput](../interfaces/SequentialChainInput.md).[outputVariables](../interfaces/SequentialChainInput.md#outputvariables)

#### Defined in

[langchain/src/chains/sequential_chain.ts:36](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sequential_chain.ts#L36)

### verbose

> **verbose**: `boolean`

Whether to print out response text.

#### Implementation of

[SequentialChainInput](../interfaces/SequentialChainInput.md).[verbose](../interfaces/SequentialChainInput.md#verbose)

#### Inherited from

[BaseChain](BaseChain.md).[verbose](BaseChain.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L27)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Implementation of

[SequentialChainInput](../interfaces/SequentialChainInput.md).[callbacks](../interfaces/SequentialChainInput.md#callbacks)

#### Inherited from

[BaseChain](BaseChain.md).[callbacks](BaseChain.md#callbacks)

#### Defined in

[langchain/src/base_language/index.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L29)

### memory?

> **memory**: [`BaseMemory`](../../memory/classes/BaseMemory.md)

#### Implementation of

[SequentialChainInput](../interfaces/SequentialChainInput.md).[memory](../interfaces/SequentialChainInput.md#memory)

#### Inherited from

[BaseChain](BaseChain.md).[memory](BaseChain.md#memory)

#### Defined in

[langchain/src/chains/base.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L27)

### returnAll?

> **returnAll**: `boolean`

Whether or not to return all intermediate outputs and variables (excluding initial input variables).

#### Implementation of

[SequentialChainInput](../interfaces/SequentialChainInput.md).[returnAll](../interfaces/SequentialChainInput.md#returnall)

#### Defined in

[langchain/src/chains/sequential_chain.ts:38](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sequential_chain.ts#L38)

## Accessors

### inputKeys

> **inputKeys**(): `string`[]

#### Returns

`string`[]

#### Overrides

BaseChain.inputKeys

#### Defined in

[langchain/src/chains/sequential_chain.ts:40](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sequential_chain.ts#L40)

#### Overrides

[BaseChain](BaseChain.md).[inputKeys](BaseChain.md#inputkeys)

#### Defined in

[langchain/src/chains/sequential_chain.ts:40](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sequential_chain.ts#L40)

### outputKeys

> **outputKeys**(): `string`[]

#### Returns

`string`[]

#### Overrides

BaseChain.outputKeys

#### Defined in

[langchain/src/chains/sequential_chain.ts:44](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sequential_chain.ts#L44)

#### Overrides

[BaseChain](BaseChain.md).[outputKeys](BaseChain.md#outputkeys)

#### Defined in

[langchain/src/chains/sequential_chain.ts:44](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sequential_chain.ts#L44)

## Methods

### \_chainType()

Return the string type key uniquely identifying this class of chain.

> **\_chainType**(): "sequential_chain"

#### Returns

"sequential_chain"

#### Overrides

[BaseChain](BaseChain.md).[\_chainType](BaseChain.md#_chaintype)

#### Defined in

[langchain/src/chains/sequential_chain.ts:148](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sequential_chain.ts#L148)

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

> **serialize**(): [`SerializedSequentialChain`](../types/SerializedSequentialChain.md)

#### Returns

[`SerializedSequentialChain`](../types/SerializedSequentialChain.md)

#### Overrides

[BaseChain](BaseChain.md).[serialize](BaseChain.md#serialize)

#### Defined in

[langchain/src/chains/sequential_chain.ts:164](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sequential_chain.ts#L164)

### deserialize()

Load a chain from a json-like object describing it.

> `Static` **deserialize**(`data`: [`SerializedSequentialChain`](../types/SerializedSequentialChain.md)): `Promise`<[`SequentialChain`](SequentialChain.md)\>

#### Parameters

| Parameter | Type                                                                 |
| :-------- | :------------------------------------------------------------------- |
| `data`    | [`SerializedSequentialChain`](../types/SerializedSequentialChain.md) |

#### Returns

`Promise`<[`SequentialChain`](SequentialChain.md)\>

#### Overrides

[BaseChain](BaseChain.md).[deserialize](BaseChain.md#deserialize)

#### Defined in

[langchain/src/chains/sequential_chain.ts:152](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sequential_chain.ts#L152)
