---
title: "HumanMessagePromptTemplate"
---

# HumanMessagePromptTemplate

## Hierarchy

- `BaseMessageStringPromptTemplate`.**HumanMessagePromptTemplate**

## Constructors

### constructor()

> **new HumanMessagePromptTemplate**(`prompt`: [`BaseStringPromptTemplate`](BaseStringPromptTemplate.md)): [`HumanMessagePromptTemplate`](HumanMessagePromptTemplate.md)

#### Parameters

| Parameter | Type                                                      |
| :-------- | :-------------------------------------------------------- |
| `prompt`  | [`BaseStringPromptTemplate`](BaseStringPromptTemplate.md) |

#### Returns

[`HumanMessagePromptTemplate`](HumanMessagePromptTemplate.md)

#### Overrides

BaseMessageStringPromptTemplate.constructor

#### Defined in

[langchain/src/prompts/chat.ts:127](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/chat.ts#L127)

## Properties

### prompt

> **prompt**: [`BaseStringPromptTemplate`](BaseStringPromptTemplate.md)

#### Inherited from

BaseMessageStringPromptTemplate.prompt

#### Defined in

[langchain/src/prompts/chat.ts:70](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/chat.ts#L70)

## Accessors

### inputVariables

> **inputVariables**(): `string`[]

#### Returns

`string`[]

#### Inherited from

BaseMessageStringPromptTemplate.inputVariables

#### Defined in

[langchain/src/prompts/chat.ts:77](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/chat.ts#L77)

#### Inherited from

BaseMessageStringPromptTemplate.inputVariables

#### Defined in

[langchain/src/prompts/chat.ts:77](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/chat.ts#L77)

## Methods

### format()

> **format**(`values`: [`InputValues`](../../schema/types/InputValues.md)): `Promise`<[`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)\>

#### Parameters

| Parameter | Type                                               |
| :-------- | :------------------------------------------------- |
| `values`  | [`InputValues`](../../schema/types/InputValues.md) |

#### Returns

`Promise`<[`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)\>

#### Overrides

BaseMessageStringPromptTemplate.format

#### Defined in

[langchain/src/prompts/chat.ts:123](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/chat.ts#L123)

### formatMessages()

> **formatMessages**(`values`: [`InputValues`](../../schema/types/InputValues.md)): `Promise`<[`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[]\>

#### Parameters

| Parameter | Type                                               |
| :-------- | :------------------------------------------------- |
| `values`  | [`InputValues`](../../schema/types/InputValues.md) |

#### Returns

`Promise`<[`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[]\>

#### Inherited from

BaseMessageStringPromptTemplate.formatMessages

#### Defined in

[langchain/src/prompts/chat.ts:83](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/chat.ts#L83)

### serialize()

> **serialize**(): [`SerializedMessagePromptTemplate`](../types/SerializedMessagePromptTemplate.md)

#### Returns

[`SerializedMessagePromptTemplate`](../types/SerializedMessagePromptTemplate.md)

#### Inherited from

BaseMessageStringPromptTemplate.serialize

#### Defined in

[langchain/src/prompts/chat.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/chat.ts#L27)

### fromTemplate()

> `Static` **fromTemplate**(`template`: `string`): [`HumanMessagePromptTemplate`](HumanMessagePromptTemplate.md)

#### Parameters

| Parameter  | Type     |
| :--------- | :------- |
| `template` | `string` |

#### Returns

[`HumanMessagePromptTemplate`](HumanMessagePromptTemplate.md)

#### Defined in

[langchain/src/prompts/chat.ts:131](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/chat.ts#L131)
