---
title: "CombiningOutputParser"
---

# CombiningOutputParser

Class to combine multiple output parsers

## Hierarchy

- `BaseOutputParser`.**CombiningOutputParser**

## Constructors

### constructor()

> **new CombiningOutputParser**(...`parsers`: `BaseOutputParser`<`unknown`\>[]): [`CombiningOutputParser`](CombiningOutputParser.md)

#### Parameters

| Parameter    | Type                              |
| :----------- | :-------------------------------- |
| `...parsers` | `BaseOutputParser`<`unknown`\>[] |

#### Returns

[`CombiningOutputParser`](CombiningOutputParser.md)

#### Overrides

BaseOutputParser.constructor

#### Defined in

[langchain/src/output_parsers/combining.ts:14](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/output_parsers/combining.ts#L14)

## Properties

### parsers

> **parsers**: `BaseOutputParser`<`unknown`\>[]

#### Defined in

[langchain/src/output_parsers/combining.ts:12](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/output_parsers/combining.ts#L12)

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

> **getFormatInstructions**(): `string`

#### Returns

`string`

#### Overrides

BaseOutputParser.getFormatInstructions

#### Defined in

[langchain/src/output_parsers/combining.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/output_parsers/combining.ts#L27)

### parse()

> **parse**(`input`: `string`, `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<`CombinedOutput`\>

#### Parameters

| Parameter    | Type                                              |
| :----------- | :------------------------------------------------ |
| `input`      | `string`                                          |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md) |

#### Returns

`Promise`<`CombinedOutput`\>

#### Overrides

BaseOutputParser.parse

#### Defined in

[langchain/src/output_parsers/combining.ts:19](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/output_parsers/combining.ts#L19)

### parseWithPrompt()

> **parseWithPrompt**(`text`: `string`, `_prompt`: [`BasePromptValue`](../../schema/classes/BasePromptValue.md), `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<`unknown`\>

#### Parameters

| Parameter    | Type                                                         |
| :----------- | :----------------------------------------------------------- |
| `text`       | `string`                                                     |
| `_prompt`    | [`BasePromptValue`](../../schema/classes/BasePromptValue.md) |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md)            |

#### Returns

`Promise`<`unknown`\>

#### Inherited from

BaseOutputParser.parseWithPrompt

#### Defined in

[langchain/src/schema/output_parser.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/output_parser.ts#L15)
