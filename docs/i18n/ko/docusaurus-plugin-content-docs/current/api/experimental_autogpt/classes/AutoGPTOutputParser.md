---
title: "AutoGPTOutputParser"
---

# AutoGPTOutputParser

## Hierarchy

- `BaseOutputParser`<[`AutoGPTAction`](../interfaces/AutoGPTAction.md)\>.**AutoGPTOutputParser**

## Constructors

### constructor()

> **new AutoGPTOutputParser**(): [`AutoGPTOutputParser`](AutoGPTOutputParser.md)

#### Returns

[`AutoGPTOutputParser`](AutoGPTOutputParser.md)

#### Inherited from

BaseOutputParser<AutoGPTAction\>.constructor

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

[langchain/src/experimental/autogpt/output_parser.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/autogpt/output_parser.ts#L15)

### parse()

> **parse**(`text`: `string`): `Promise`<[`AutoGPTAction`](../interfaces/AutoGPTAction.md)\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `text`    | `string` |

#### Returns

`Promise`<[`AutoGPTAction`](../interfaces/AutoGPTAction.md)\>

#### Overrides

BaseOutputParser.parse

#### Defined in

[langchain/src/experimental/autogpt/output_parser.ts:19](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/autogpt/output_parser.ts#L19)

### parseWithPrompt()

> **parseWithPrompt**(`text`: `string`, `_prompt`: [`BasePromptValue`](../../schema/classes/BasePromptValue.md), `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<[`AutoGPTAction`](../interfaces/AutoGPTAction.md)\>

#### Parameters

| Parameter    | Type                                                         |
| :----------- | :----------------------------------------------------------- |
| `text`       | `string`                                                     |
| `_prompt`    | [`BasePromptValue`](../../schema/classes/BasePromptValue.md) |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md)            |

#### Returns

`Promise`<[`AutoGPTAction`](../interfaces/AutoGPTAction.md)\>

#### Inherited from

BaseOutputParser.parseWithPrompt

#### Defined in

[langchain/src/schema/output_parser.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/output_parser.ts#L15)
