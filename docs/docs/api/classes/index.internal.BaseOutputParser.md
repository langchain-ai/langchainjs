---
id: "index.internal.BaseOutputParser"
title: "Class: BaseOutputParser"
sidebar_label: "BaseOutputParser"
custom_edit_url: null
---

[index](../modules/).[internal](../modules/.internal).BaseOutputParser

Class to parse the output of an LLM call.

## Constructors

### constructor

• **new BaseOutputParser**()

## Methods

### \_type

▸ **_type**(): `string`

Return the string type key uniquely identifying this class of parser

#### Returns

`string`

#### Defined in

[prompt/parser.ts:20](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/parser.ts#L20)

___

### parse

▸ `Abstract` **parse**(`text`): `string` \| `string`[] \| `Record`<`string`, `string`\>

Parse the output of an LLM call.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `text` | `string` | LLM output to parse. |

#### Returns

`string` \| `string`[] \| `Record`<`string`, `string`\>

Parsed output.

#### Defined in

[prompt/parser.ts:15](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/parser.ts#L15)

___

### serialize

▸ `Abstract` **serialize**(): [`SerializedOutputParser`](../modules/.internal#serializedoutputparser)

Return a json-like object representing this output parser.

#### Returns

[`SerializedOutputParser`](../modules/.internal#serializedoutputparser)

#### Defined in

[prompt/parser.ts:27](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/parser.ts#L27)

___

### deserialize

▸ `Static` **deserialize**(`data`): [`BaseOutputParser`](.internal.BaseOutputParser)

Load an output parser from a json-like object describing the parser.

#### Parameters

| Name | Type |
| :------ | :------ |
| `data` | [`SerializedOutputParser`](../modules/.internal#serializedoutputparser) |

#### Returns

[`BaseOutputParser`](.internal.BaseOutputParser)

#### Defined in

[prompt/parser.ts:32](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/parser.ts#L32)
