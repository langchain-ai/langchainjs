---
title: "BaseChatMessage"
---

# BaseChatMessage

## Hierarchy

- [`HumanChatMessage`](HumanChatMessage.md)
- [`AIChatMessage`](AIChatMessage.md)
- [`SystemChatMessage`](SystemChatMessage.md)
- [`ChatMessage`](ChatMessage.md)

## Constructors

### constructor()

> **new BaseChatMessage**(`text`: `string`): [`BaseChatMessage`](BaseChatMessage.md)

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `text`    | `string` |

#### Returns

[`BaseChatMessage`](BaseChatMessage.md)

#### Defined in

[langchain/src/schema/index.ts:62](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/index.ts#L62)

## Properties

### text

> **text**: `string`

The text of the message.

#### Defined in

[langchain/src/schema/index.ts:54](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/index.ts#L54)

### name?

> **name**: `string`

The name of the message sender in a multi-user chat.

#### Defined in

[langchain/src/schema/index.ts:57](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/index.ts#L57)

## Methods

### \_getType()

The type of the message.

> `Abstract` **\_getType**(): [`MessageType`](../types/MessageType.md)

#### Returns

[`MessageType`](../types/MessageType.md)

#### Defined in

[langchain/src/schema/index.ts:60](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/index.ts#L60)
