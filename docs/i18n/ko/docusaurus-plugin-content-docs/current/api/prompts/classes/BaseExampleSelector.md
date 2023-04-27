---
title: "BaseExampleSelector"
---

# BaseExampleSelector

Base class for example selectors.

## Constructors

### constructor()

> **new BaseExampleSelector**(): [`BaseExampleSelector`](BaseExampleSelector.md)

#### Returns

[`BaseExampleSelector`](BaseExampleSelector.md)

## Methods

### addExample()

> `Abstract` **addExample**(`example`: [`Example`](../../schema/types/Example.md)): `Promise`<`string` \| `void`\>

#### Parameters

| Parameter | Type                                       |
| :-------- | :----------------------------------------- |
| `example` | [`Example`](../../schema/types/Example.md) |

#### Returns

`Promise`<`string` \| `void`\>

#### Defined in

[langchain/src/prompts/base.ts:161](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L161)

### selectExamples()

> `Abstract` **selectExamples**(`input_variables`: [`Example`](../../schema/types/Example.md)): `Promise`<[`Example`](../../schema/types/Example.md)[]\>

#### Parameters

| Parameter         | Type                                       |
| :---------------- | :----------------------------------------- |
| `input_variables` | [`Example`](../../schema/types/Example.md) |

#### Returns

`Promise`<[`Example`](../../schema/types/Example.md)[]\>

#### Defined in

[langchain/src/prompts/base.ts:163](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L163)
