---
id: "agents.Tool"
title: "Class: Tool"
sidebar_label: "Tool"
custom_edit_url: null
---

[agents](../modules/agents.md).Tool

## Hierarchy

- **`Tool`**

  ↳ [`SerpAPI`](agents_tools.SerpAPI.md)

  ↳ [`Calculator`](agents_tools.Calculator.md)

## Constructors

### constructor

• **new Tool**()

## Properties

### description

• `Abstract` **description**: `string`

#### Defined in

[agents/tools/base.ts:6](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/agents/tools/base.ts#L6)

___

### name

• `Abstract` **name**: `string`

#### Defined in

[agents/tools/base.ts:4](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/agents/tools/base.ts#L4)

___

### returnDirect

• **returnDirect**: `boolean` = `false`

#### Defined in

[agents/tools/base.ts:8](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/agents/tools/base.ts#L8)

## Methods

### call

▸ `Abstract` **call**(`arg`): `Promise`<`string`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `arg` | `string` |

#### Returns

`Promise`<`string`\>

#### Defined in

[agents/tools/base.ts:2](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/agents/tools/base.ts#L2)
