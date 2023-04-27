---
title: "HumanChatMessage"
---

# HumanChatMessage

## Hierarchy

- [`BaseChatMessage`](BaseChatMessage.md).**HumanChatMessage**

## Constructors

### constructor()

> **new HumanChatMessage**(`text`: `string`): [`HumanChatMessage`](HumanChatMessage.md)

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `text`    | `string` |

#### Returns

[`HumanChatMessage`](HumanChatMessage.md)

#### Inherited from

[BaseChatMessage](BaseChatMessage.md).[constructor](BaseChatMessage.md#constructor)

#### Defined in

[langchain/src/schema/index.ts:62](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/index.ts#L62)

## Properties

### text

> **text**: `string`

The text of the message.

#### Inherited from

[BaseChatMessage](BaseChatMessage.md).[text](BaseChatMessage.md#text)

#### Defined in

[langchain/src/schema/index.ts:54](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/index.ts#L54)

### name?

> **name**: `string`

The name of the message sender in a multi-user chat.

#### Inherited from

[BaseChatMessage](BaseChatMessage.md).[name](BaseChatMessage.md#name)

#### Defined in

[langchain/src/schema/index.ts:57](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/index.ts#L57)

## Methods

### \_getType()

The type of the message.

> **\_getType**(): [`MessageType`](../types/MessageType.md)

#### Returns

[`MessageType`](../types/MessageType.md)

#### Overrides

[BaseChatMessage](BaseChatMessage.md).[\_getType](BaseChatMessage.md#_gettype)

#### Defined in

[langchain/src/schema/index.ts:68](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/index.ts#L68)
