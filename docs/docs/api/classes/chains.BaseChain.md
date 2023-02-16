---
id: "chains.BaseChain"
title: "Class: BaseChain"
sidebar_label: "BaseChain"
custom_edit_url: null
---

[chains](../modules/chains.md).BaseChain

Base interface that all chains must implement.

## Hierarchy

- **`BaseChain`**

  ↳ [`LLMChain`](.LLMChain)

  ↳ [`AgentExecutor`](agents.AgentExecutor.md)

  ↳ [`StuffDocumentsChain`](chains.StuffDocumentsChain.md)

## Constructors

### constructor

• **new BaseChain**()

## Methods

### \_call

▸ `Abstract` **_call**(`values`): `Promise`<[`ChainValues`](../modules/chains.md#chainvalues)\>

Run the core logic of this chain and return the output

#### Parameters

| Name | Type |
| :------ | :------ |
| `values` | [`ChainValues`](../modules/chains.md#chainvalues) |

#### Returns

`Promise`<[`ChainValues`](../modules/chains.md#chainvalues)\>

#### Defined in

[chains/base.ts:18](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/chains/base.ts#L18)

___

### \_chainType

▸ `Abstract` **_chainType**(): `string`

Return the string type key uniquely identifying this class of chain.

#### Returns

`string`

#### Defined in

[chains/base.ts:23](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/chains/base.ts#L23)

___

### apply

▸ **apply**(`inputs`): [`ChainValues`](../modules/chains.md#chainvalues)[]

Call the chain on all inputs in the list

#### Parameters

| Name | Type |
| :------ | :------ |
| `inputs` | [`ChainValues`](../modules/chains.md#chainvalues)[] |

#### Returns

[`ChainValues`](../modules/chains.md#chainvalues)[]

#### Defined in

[chains/base.ts:43](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/chains/base.ts#L43)

___

### call

▸ **call**(`values`): `Promise`<[`ChainValues`](../modules/chains.md#chainvalues)\>

Run the core logic of this chain and add to output if desired.

Eventually will handle memory, validation, etc. but for now just wraps [_call](chains.BaseChain.md#_call)

#### Parameters

| Name | Type |
| :------ | :------ |
| `values` | [`ChainValues`](../modules/chains.md#chainvalues) |

#### Returns

`Promise`<[`ChainValues`](../modules/chains.md#chainvalues)\>

#### Defined in

[chains/base.ts:35](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/chains/base.ts#L35)

___

### serialize

▸ `Abstract` **serialize**(): [`SerializedBaseChain`](../modules/agents.internal.md#serializedbasechain)

Return a json-like object representing this chain.

#### Returns

[`SerializedBaseChain`](../modules/agents.internal.md#serializedbasechain)

#### Defined in

[chains/base.ts:28](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/chains/base.ts#L28)

___

### deserialize

▸ `Static` **deserialize**(`data`): `Promise`<[`BaseChain`](chains.BaseChain.md)\>

Load a chain from a json-like object describing it.

#### Parameters

| Name | Type |
| :------ | :------ |
| `data` | [`SerializedBaseChain`](../modules/agents.internal.md#serializedbasechain) |

#### Returns

`Promise`<[`BaseChain`](chains.BaseChain.md)\>

#### Defined in

[chains/base.ts:50](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/chains/base.ts#L50)
