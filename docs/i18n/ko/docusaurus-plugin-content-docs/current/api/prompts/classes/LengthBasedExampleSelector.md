---
title: "LengthBasedExampleSelector"
---

# LengthBasedExampleSelector

Base class for example selectors.

## Implements

- [`BaseExampleSelector`](BaseExampleSelector.md)

## Constructors

### constructor()

> **new LengthBasedExampleSelector**(`data`: [`LengthBasedExampleSelectorInput`](../interfaces/LengthBasedExampleSelectorInput.md)): [`LengthBasedExampleSelector`](LengthBasedExampleSelector.md)

#### Parameters

| Parameter | Type                                                                                  |
| :-------- | :------------------------------------------------------------------------------------ |
| `data`    | [`LengthBasedExampleSelectorInput`](../interfaces/LengthBasedExampleSelectorInput.md) |

#### Returns

[`LengthBasedExampleSelector`](LengthBasedExampleSelector.md)

#### Defined in

[langchain/src/prompts/selectors/LengthBasedExampleSelector.ts:26](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/selectors/LengthBasedExampleSelector.ts#L26)

## Properties

### examplePrompt

> **examplePrompt**: [`PromptTemplate`](PromptTemplate.md)

#### Defined in

[langchain/src/prompts/selectors/LengthBasedExampleSelector.ts:18](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/selectors/LengthBasedExampleSelector.ts#L18)

### exampleTextLengths

> **exampleTextLengths**: `number`[] = `[]`

#### Defined in

[langchain/src/prompts/selectors/LengthBasedExampleSelector.ts:24](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/selectors/LengthBasedExampleSelector.ts#L24)

### getTextLength

> **getTextLength**: `Function` = `getLengthBased`

#### Type declaration

> (`text`: `string`): `number`

##### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `text`    | `string` |

##### Returns

`number`

#### Defined in

[langchain/src/prompts/selectors/LengthBasedExampleSelector.ts:20](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/selectors/LengthBasedExampleSelector.ts#L20)

### maxLength

> **maxLength**: `number` = `2048`

#### Defined in

[langchain/src/prompts/selectors/LengthBasedExampleSelector.ts:22](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/selectors/LengthBasedExampleSelector.ts#L22)

### examples

> `Protected` **examples**: [`Example`](../../schema/types/Example.md)[] = `[]`

#### Defined in

[langchain/src/prompts/selectors/LengthBasedExampleSelector.ts:16](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/selectors/LengthBasedExampleSelector.ts#L16)

## Methods

### addExample()

> **addExample**(`example`: [`Example`](../../schema/types/Example.md)): `Promise`<`void`\>

#### Parameters

| Parameter | Type                                       |
| :-------- | :----------------------------------------- |
| `example` | [`Example`](../../schema/types/Example.md) |

#### Returns

`Promise`<`void`\>

#### Implementation of

[BaseExampleSelector](BaseExampleSelector.md).[addExample](BaseExampleSelector.md#addexample)

#### Defined in

[langchain/src/prompts/selectors/LengthBasedExampleSelector.ts:32](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/selectors/LengthBasedExampleSelector.ts#L32)

### calculateExampleTextLengths()

> **calculateExampleTextLengths**(`v`: `number`[], `values`: [`LengthBasedExampleSelector`](LengthBasedExampleSelector.md)): `Promise`<`number`[]\>

#### Parameters

| Parameter | Type                                                          |
| :-------- | :------------------------------------------------------------ |
| `v`       | `number`[]                                                    |
| `values`  | [`LengthBasedExampleSelector`](LengthBasedExampleSelector.md) |

#### Returns

`Promise`<`number`[]\>

#### Defined in

[langchain/src/prompts/selectors/LengthBasedExampleSelector.ts:38](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/selectors/LengthBasedExampleSelector.ts#L38)

### selectExamples()

> **selectExamples**(`inputVariables`: [`Example`](../../schema/types/Example.md)): `Promise`<[`Example`](../../schema/types/Example.md)[]\>

#### Parameters

| Parameter        | Type                                       |
| :--------------- | :----------------------------------------- |
| `inputVariables` | [`Example`](../../schema/types/Example.md) |

#### Returns

`Promise`<[`Example`](../../schema/types/Example.md)[]\>

#### Implementation of

[BaseExampleSelector](BaseExampleSelector.md).[selectExamples](BaseExampleSelector.md#selectexamples)

#### Defined in

[langchain/src/prompts/selectors/LengthBasedExampleSelector.ts:53](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/selectors/LengthBasedExampleSelector.ts#L53)

### fromExamples()

> `Static` **fromExamples**(`examples`: [`Example`](../../schema/types/Example.md)[], `args`: [`LengthBasedExampleSelectorInput`](../interfaces/LengthBasedExampleSelectorInput.md)): `Promise`<[`LengthBasedExampleSelector`](LengthBasedExampleSelector.md)\>

#### Parameters

| Parameter  | Type                                                                                  |
| :--------- | :------------------------------------------------------------------------------------ |
| `examples` | [`Example`](../../schema/types/Example.md)[]                                          |
| `args`     | [`LengthBasedExampleSelectorInput`](../interfaces/LengthBasedExampleSelectorInput.md) |

#### Returns

`Promise`<[`LengthBasedExampleSelector`](LengthBasedExampleSelector.md)\>

#### Defined in

[langchain/src/prompts/selectors/LengthBasedExampleSelector.ts:73](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/selectors/LengthBasedExampleSelector.ts#L73)
