---
title: "OutputFixingParser<T>"
---

# OutputFixingParser<T\>

## Type parameters

- `T`

## Hierarchy

- `BaseOutputParser`<`T`\>.**OutputFixingParser**

## Constructors

### constructor()

> **new OutputFixingParser**<T\>(«destructured»: `object`): [`OutputFixingParser`](OutputFixingParser.md)<`T`\>

#### Type parameters

- `T`

#### Parameters

| Parameter        | Type                                           |
| :--------------- | :--------------------------------------------- |
| `«destructured»` | `object`                                       |
| › `parser`       | `BaseOutputParser`<`T`\>                      |
| › `retryChain`   | [`LLMChain`](../../chains/classes/LLMChain.md) |

#### Returns

[`OutputFixingParser`](OutputFixingParser.md)<`T`\>

#### Overrides

BaseOutputParser<T\>.constructor

#### Defined in

[langchain/src/output_parsers/fix.ts:28](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/output_parsers/fix.ts#L28)

## Properties

### parser

> **parser**: `BaseOutputParser`<`T`\>

#### Defined in

[langchain/src/output_parsers/fix.ts:12](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/output_parsers/fix.ts#L12)

### retryChain

> **retryChain**: [`LLMChain`](../../chains/classes/LLMChain.md)

#### Defined in

[langchain/src/output_parsers/fix.ts:14](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/output_parsers/fix.ts#L14)

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

[langchain/src/output_parsers/fix.ts:61](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/output_parsers/fix.ts#L61)

### parse()

> **parse**(`completion`: `string`, `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<`T`\>

#### Parameters

| Parameter    | Type                                              |
| :----------- | :------------------------------------------------ |
| `completion` | `string`                                          |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md) |

#### Returns

`Promise`<`T`\>

#### Overrides

BaseOutputParser.parse

#### Defined in

[langchain/src/output_parsers/fix.ts:40](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/output_parsers/fix.ts#L40)

### parseWithPrompt()

> **parseWithPrompt**(`text`: `string`, `_prompt`: [`BasePromptValue`](../../schema/classes/BasePromptValue.md), `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<`T`\>

#### Parameters

| Parameter    | Type                                                         |
| :----------- | :----------------------------------------------------------- |
| `text`       | `string`                                                     |
| `_prompt`    | [`BasePromptValue`](../../schema/classes/BasePromptValue.md) |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md)            |

#### Returns

`Promise`<`T`\>

#### Inherited from

BaseOutputParser.parseWithPrompt

#### Defined in

[langchain/src/schema/output_parser.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/output_parser.ts#L15)

### fromLLM()

> `Static` **fromLLM**<T\>(`llm`: [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md), `parser`: `BaseOutputParser`<`T`\>, `fields`?: `object`): [`OutputFixingParser`](OutputFixingParser.md)<`T`\>

#### Type parameters

- `T`

#### Parameters

| Parameter        | Type                                                                    |
| :--------------- | :---------------------------------------------------------------------- |
| `llm`            | [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md) |
| `parser`         | `BaseOutputParser`<`T`\>                                               |
| `fields?`        | `object`                                                                |
| `fields.prompt?` | [`BasePromptTemplate`](../../prompts/classes/BasePromptTemplate.md)     |

#### Returns

[`OutputFixingParser`](OutputFixingParser.md)<`T`\>

#### Defined in

[langchain/src/output_parsers/fix.ts:16](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/output_parsers/fix.ts#L16)
