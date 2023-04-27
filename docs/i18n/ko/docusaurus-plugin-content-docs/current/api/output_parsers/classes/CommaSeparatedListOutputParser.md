---
title: "CommaSeparatedListOutputParser"
---

# CommaSeparatedListOutputParser

Class to parse the output of an LLM call as a comma-separated list.

## Hierarchy

- [`ListOutputParser`](ListOutputParser.md).**CommaSeparatedListOutputParser**

## Constructors

### constructor()

> **new CommaSeparatedListOutputParser**(): [`CommaSeparatedListOutputParser`](CommaSeparatedListOutputParser.md)

#### Returns

[`CommaSeparatedListOutputParser`](CommaSeparatedListOutputParser.md)

#### Inherited from

[ListOutputParser](ListOutputParser.md).[constructor](ListOutputParser.md#constructor)

## Methods

### \_type()

Return the string type key uniquely identifying this class of parser

> **\_type**(): `string`

#### Returns

`string`

#### Inherited from

[ListOutputParser](ListOutputParser.md).[\_type](ListOutputParser.md#_type)

#### Defined in

[langchain/src/schema/output_parser.ts:38](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/output_parser.ts#L38)

### getFormatInstructions()

Return a string describing the format of the output.

#### Example

```json
{
  "foo": "bar"
}
```

> **getFormatInstructions**(): `string`

#### Returns

`string`

Format instructions.

#### Overrides

[ListOutputParser](ListOutputParser.md).[getFormatInstructions](ListOutputParser.md#getformatinstructions)

#### Defined in

[langchain/src/output_parsers/list.ts:28](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/output_parsers/list.ts#L28)

### parse()

Parse the output of an LLM call.

> **parse**(`text`: `string`): `Promise`<`string`[]\>

#### Parameters

| Parameter | Type     | Description          |
| :-------- | :------- | :------------------- |
| `text`    | `string` | LLM output to parse. |

#### Returns

`Promise`<`string`[]\>

Parsed output.

#### Overrides

[ListOutputParser](ListOutputParser.md).[parse](ListOutputParser.md#parse)

#### Defined in

[langchain/src/output_parsers/list.ts:17](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/output_parsers/list.ts#L17)

### parseWithPrompt()

> **parseWithPrompt**(`text`: `string`, `_prompt`: [`BasePromptValue`](../../schema/classes/BasePromptValue.md), `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<`string`[]\>

#### Parameters

| Parameter    | Type                                                         |
| :----------- | :----------------------------------------------------------- |
| `text`       | `string`                                                     |
| `_prompt`    | [`BasePromptValue`](../../schema/classes/BasePromptValue.md) |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md)            |

#### Returns

`Promise`<`string`[]\>

#### Inherited from

[ListOutputParser](ListOutputParser.md).[parseWithPrompt](ListOutputParser.md#parsewithprompt)

#### Defined in

[langchain/src/schema/output_parser.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/output_parser.ts#L15)
