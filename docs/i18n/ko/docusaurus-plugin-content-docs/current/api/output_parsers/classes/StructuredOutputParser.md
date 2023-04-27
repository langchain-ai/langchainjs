---
title: "StructuredOutputParser<T>"
---

# StructuredOutputParser<T\>

## Type parameters

- `T` _extends_ `z.ZodTypeAny`

## Hierarchy

- `BaseOutputParser`<`z.infer`<`T`\>\>.**StructuredOutputParser**

## Constructors

### constructor()

> **new StructuredOutputParser**<T\>(`schema`: `T`): [`StructuredOutputParser`](StructuredOutputParser.md)<`T`\>

#### Type parameters

- `T` _extends_ `ZodType`<`any`, `any`, `any`, `T`\>

#### Parameters

| Parameter | Type |
| :-------- | :--- |
| `schema`  | `T`  |

#### Returns

[`StructuredOutputParser`](StructuredOutputParser.md)<`T`\>

#### Overrides

BaseOutputParser<z.infer<T\>\>.constructor

#### Defined in

[langchain/src/output_parsers/structured.ts:70](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/output_parsers/structured.ts#L70)

## Properties

### schema

> **schema**: `T`

#### Defined in

[langchain/src/output_parsers/structured.ts:70](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/output_parsers/structured.ts#L70)

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

[langchain/src/output_parsers/structured.ts:93](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/output_parsers/structured.ts#L93)

### parse()

> **parse**(`text`: `string`): `Promise`<`TypeOf`<`T`\>\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `text`    | `string` |

#### Returns

`Promise`<`TypeOf`<`T`\>\>

#### Overrides

BaseOutputParser.parse

#### Defined in

[langchain/src/output_parsers/structured.ts:104](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/output_parsers/structured.ts#L104)

### parseWithPrompt()

> **parseWithPrompt**(`text`: `string`, `_prompt`: [`BasePromptValue`](../../schema/classes/BasePromptValue.md), `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<`TypeOf`<`T`\>\>

#### Parameters

| Parameter    | Type                                                         |
| :----------- | :----------------------------------------------------------- |
| `text`       | `string`                                                     |
| `_prompt`    | [`BasePromptValue`](../../schema/classes/BasePromptValue.md) |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md)            |

#### Returns

`Promise`<`TypeOf`<`T`\>\>

#### Inherited from

BaseOutputParser.parseWithPrompt

#### Defined in

[langchain/src/schema/output_parser.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/output_parser.ts#L15)

### fromNamesAndDescriptions()

> `Static` **fromNamesAndDescriptions**<S\>(`schemas`: `S`): [`StructuredOutputParser`](StructuredOutputParser.md)<`ZodObject`<\{}, "strip", `ZodTypeAny`, \{}, \{}\>\>

#### Type parameters

- `S` _extends_ \{}

#### Parameters

| Parameter | Type |
| :-------- | :--- |
| `schemas` | `S`  |

#### Returns

[`StructuredOutputParser`](StructuredOutputParser.md)<`ZodObject`<\{}, "strip", `ZodTypeAny`, \{}, \{}\>\>

#### Defined in

[langchain/src/output_parsers/structured.ts:78](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/output_parsers/structured.ts#L78)

### fromZodSchema()

> `Static` **fromZodSchema**<T\>(`schema`: `T`): [`StructuredOutputParser`](StructuredOutputParser.md)<`T`\>

#### Type parameters

- `T` _extends_ `ZodType`<`any`, `any`, `any`, `T`\>

#### Parameters

| Parameter | Type |
| :-------- | :--- |
| `schema`  | `T`  |

#### Returns

[`StructuredOutputParser`](StructuredOutputParser.md)<`T`\>

#### Defined in

[langchain/src/output_parsers/structured.ts:74](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/output_parsers/structured.ts#L74)
