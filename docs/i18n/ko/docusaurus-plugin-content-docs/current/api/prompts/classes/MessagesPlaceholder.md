---
title: "MessagesPlaceholder"
---

# MessagesPlaceholder

## Hierarchy

- `BaseMessagePromptTemplate`.**MessagesPlaceholder**

## Constructors

### constructor()

> **new MessagesPlaceholder**(`variableName`: `string`): [`MessagesPlaceholder`](MessagesPlaceholder.md)

#### Parameters

| Parameter      | Type     |
| :------------- | :------- |
| `variableName` | `string` |

#### Returns

[`MessagesPlaceholder`](MessagesPlaceholder.md)

#### Overrides

BaseMessagePromptTemplate.constructor

#### Defined in

[langchain/src/prompts/chat.ts:55](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/chat.ts#L55)

## Properties

### variableName

> **variableName**: `string`

#### Defined in

[langchain/src/prompts/chat.ts:53](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/chat.ts#L53)

## Accessors

### inputVariables

> **inputVariables**(): `string`[]

#### Returns

`string`[]

#### Overrides

BaseMessagePromptTemplate.inputVariables

#### Defined in

[langchain/src/prompts/chat.ts:60](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/chat.ts#L60)

#### Overrides

BaseMessagePromptTemplate.inputVariables

#### Defined in

[langchain/src/prompts/chat.ts:60](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/chat.ts#L60)

## Methods

### formatMessages()

> **formatMessages**(`values`: [`InputValues`](../../schema/types/InputValues.md)): `Promise`<[`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[]\>

#### Parameters

| Parameter | Type                                               |
| :-------- | :------------------------------------------------- |
| `values`  | [`InputValues`](../../schema/types/InputValues.md) |

#### Returns

`Promise`<[`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[]\>

#### Overrides

BaseMessagePromptTemplate.formatMessages

#### Defined in

[langchain/src/prompts/chat.ts:64](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/chat.ts#L64)

### serialize()

> **serialize**(): [`SerializedMessagePromptTemplate`](../types/SerializedMessagePromptTemplate.md)

#### Returns

[`SerializedMessagePromptTemplate`](../types/SerializedMessagePromptTemplate.md)

#### Inherited from

BaseMessagePromptTemplate.serialize

#### Defined in

[langchain/src/prompts/chat.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/chat.ts#L27)
