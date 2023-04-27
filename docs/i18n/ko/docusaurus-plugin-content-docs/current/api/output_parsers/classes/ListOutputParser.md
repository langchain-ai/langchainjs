---
title: "ListOutputParser"
---

# ListOutputParser

Class to parse the output of an LLM call to a list.

## Hierarchy

- `BaseOutputParser`<`string`[]\>.**ListOutputParser**

## Constructors

### constructor()

> **new ListOutputParser**(): [`ListOutputParser`](ListOutputParser.md)

#### Returns

[`ListOutputParser`](ListOutputParser.md)

#### Inherited from

BaseOutputParser<string[]\>.constructor

## Methods

### \_type()

Return the string type key uniquely identifying this class of parser

> **\_type**(): `string`

#### Returns

`string`

#### Inherited from

BaseOutputParser.\_type

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

> `Abstract` **getFormatInstructions**(): `string`

#### Returns

`string`

Format instructions.

#### Inherited from

BaseOutputParser.getFormatInstructions

#### Defined in

[langchain/src/schema/output_parser.ts:33](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/output_parser.ts#L33)

### parse()

Parse the output of an LLM call.

> `Abstract` **parse**(`text`: `string`, `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<`string`[]\>

#### Parameters

| Parameter    | Type                                              | Description          |
| :----------- | :------------------------------------------------ | :------------------- |
| `text`       | `string`                                          | LLM output to parse. |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md) | -                    |

#### Returns

`Promise`<`string`[]\>

Parsed output.

#### Inherited from

BaseOutputParser.parse

#### Defined in

[langchain/src/schema/output_parser.ts:13](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/output_parser.ts#L13)

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

BaseOutputParser.parseWithPrompt

#### Defined in

[langchain/src/schema/output_parser.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/output_parser.ts#L15)
