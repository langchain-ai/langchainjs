---
id: "agents_tools.Calculator"
title: "Class: Calculator"
sidebar_label: "Calculator"
custom_edit_url: null
---

[agents/tools](../modules/agents_tools.md).Calculator

## Hierarchy

- [`Tool`](agents.Tool.md)

  ↳ **`Calculator`**

## Constructors

### constructor

• **new Calculator**()

#### Inherited from

[Tool](agents.Tool.md).[constructor](agents.Tool.md#constructor)

## Properties

### description

• **description**: `string` = `"Useful for getting the result of a math expression."`

#### Overrides

[Tool](agents.Tool.md).[description](agents.Tool.md#description)

#### Defined in

[agents/tools/calculator.ts:16](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/agents/tools/calculator.ts#L16)

___

### name

• **name**: `string` = `"calculator"`

#### Overrides

[Tool](agents.Tool.md).[name](agents.Tool.md#name)

#### Defined in

[agents/tools/calculator.ts:6](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/agents/tools/calculator.ts#L6)

___

### returnDirect

• **returnDirect**: `boolean` = `false`

#### Inherited from

[Tool](agents.Tool.md).[returnDirect](agents.Tool.md#returndirect)

#### Defined in

[agents/tools/base.ts:8](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/agents/tools/base.ts#L8)

## Methods

### call

▸ **call**(`input`): `Promise`<`string`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `input` | `string` |

#### Returns

`Promise`<`string`\>

#### Overrides

[Tool](agents.Tool.md).[call](agents.Tool.md#call)

#### Defined in

[agents/tools/calculator.ts:8](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/agents/tools/calculator.ts#L8)
