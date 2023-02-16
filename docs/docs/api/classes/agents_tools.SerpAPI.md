---
id: "agents_tools.SerpAPI"
title: "Class: SerpAPI"
sidebar_label: "SerpAPI"
custom_edit_url: null
---

[agents/tools](../modules/agents_tools.md).SerpAPI

Wrapper around SerpAPI.

To use, you should have the `serpapi` package installed and the SERPAPI_API_KEY environment variable set.

## Hierarchy

- [`Tool`](agents.Tool.md)

  ↳ **`SerpAPI`**

## Constructors

### constructor

• **new SerpAPI**(`apiKey?`, `params?`)

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `apiKey` | `undefined` \| `string` | `process.env.SERPAPI_API_KEY` |
| `params` | `Partial`<`GoogleParameters`\> | `{}` |

#### Overrides

[Tool](agents.Tool.md).[constructor](agents.Tool.md#constructor)

#### Defined in

[agents/tools/serpapi.ts:15](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/tools/serpapi.ts#L15)

## Properties

### description

• **description**: `string` = `"a search engine. useful for when you need to answer questions about current events. input should be a search query."`

#### Overrides

[Tool](agents.Tool.md).[description](agents.Tool.md#description)

#### Defined in

[agents/tools/serpapi.ts:75](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/tools/serpapi.ts#L75)

___

### key

• `Protected` **key**: `string`

#### Defined in

[agents/tools/serpapi.ts:11](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/tools/serpapi.ts#L11)

___

### name

• **name**: `string` = `"search"`

#### Overrides

[Tool](agents.Tool.md).[name](agents.Tool.md#name)

#### Defined in

[agents/tools/serpapi.ts:32](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/tools/serpapi.ts#L32)

___

### params

• `Protected` **params**: `Partial`<`GoogleParameters`\>

#### Defined in

[agents/tools/serpapi.ts:13](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/tools/serpapi.ts#L13)

___

### returnDirect

• **returnDirect**: `boolean` = `false`

#### Inherited from

[Tool](agents.Tool.md).[returnDirect](agents.Tool.md#returndirect)

#### Defined in

[agents/tools/base.ts:8](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/tools/base.ts#L8)

## Methods

### call

▸ **call**(`input`): `Promise`<`any`\>

Run query through SerpAPI and parse result

#### Parameters

| Name | Type |
| :------ | :------ |
| `input` | `string` |

#### Returns

`Promise`<`any`\>

#### Overrides

[Tool](agents.Tool.md).[call](agents.Tool.md#call)

#### Defined in

[agents/tools/serpapi.ts:37](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/agents/tools/serpapi.ts#L37)
