---
title: "RegexParser"
---

# RegexParser

Class to parse the output of an LLM call into a dictionary.

## Hierarchy

- `BaseOutputParser`<`Record`<`string`, `string`\>\>.**RegexParser**

## Constructors

### constructor()

> **new RegexParser**(`regex`: `string` \| `RegExp`, `outputKeys`: `string`[], `defaultOutputKey`?: `string`): [`RegexParser`](RegexParser.md)

#### Parameters

| Parameter           | Type                 |
| :------------------ | :------------------- |
| `regex`             | `string` \| `RegExp` |
| `outputKeys`        | `string`[]           |
| `defaultOutputKey?` | `string`             |

#### Returns

[`RegexParser`](RegexParser.md)

#### Overrides

BaseOutputParser<Record<string, string\>\>.constructor

#### Defined in

[langchain/src/output_parsers/regex.ts:17](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/output_parsers/regex.ts#L17)

## Properties

### outputKeys

> **outputKeys**: `string`[]

#### Defined in

[langchain/src/output_parsers/regex.ts:13](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/output_parsers/regex.ts#L13)

### regex

> **regex**: `string` \| `RegExp`

#### Defined in

[langchain/src/output_parsers/regex.ts:11](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/output_parsers/regex.ts#L11)

### defaultOutputKey?

> **defaultOutputKey**: `string`

#### Defined in

[langchain/src/output_parsers/regex.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/output_parsers/regex.ts#L15)

## Methods

### \_type()

> **\_type**(): `string`

#### Returns

`string`

#### Overrides

BaseOutputParser.\_type

#### Defined in

[langchain/src/output_parsers/regex.ts:28](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/output_parsers/regex.ts#L28)

### getFormatInstructions()

> **getFormatInstructions**(): `string`

#### Returns

`string`

#### Overrides

BaseOutputParser.getFormatInstructions

#### Defined in

[langchain/src/output_parsers/regex.ts:51](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/output_parsers/regex.ts#L51)

### parse()

> **parse**(`text`: `string`): `Promise`<`Record`<`string`, `string`\>\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `text`    | `string` |

#### Returns

`Promise`<`Record`<`string`, `string`\>\>

#### Overrides

BaseOutputParser.parse

#### Defined in

[langchain/src/output_parsers/regex.ts:32](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/output_parsers/regex.ts#L32)

### parseWithPrompt()

> **parseWithPrompt**(`text`: `string`, `_prompt`: [`BasePromptValue`](../../schema/classes/BasePromptValue.md), `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<`Record`<`string`, `string`\>\>

#### Parameters

| Parameter    | Type                                                         |
| :----------- | :----------------------------------------------------------- |
| `text`       | `string`                                                     |
| `_prompt`    | [`BasePromptValue`](../../schema/classes/BasePromptValue.md) |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md)            |

#### Returns

`Promise`<`Record`<`string`, `string`\>\>

#### Inherited from

BaseOutputParser.parseWithPrompt

#### Defined in

[langchain/src/schema/output_parser.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/output_parser.ts#L15)
