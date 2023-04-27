---
title: "ChatMessageHistory"
---

# ChatMessageHistory

## Hierarchy

- [`BaseChatMessageHistory`](../../schema/classes/BaseChatMessageHistory.md).**ChatMessageHistory**

## Constructors

### constructor()

> **new ChatMessageHistory**(`messages`?: [`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[]): [`ChatMessageHistory`](ChatMessageHistory.md)

#### Parameters

| Parameter   | Type                                                           |
| :---------- | :------------------------------------------------------------- |
| `messages?` | [`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[] |

#### Returns

[`ChatMessageHistory`](ChatMessageHistory.md)

#### Overrides

[BaseChatMessageHistory](../../schema/classes/BaseChatMessageHistory.md).[constructor](../../schema/classes/BaseChatMessageHistory.md#constructor)

#### Defined in

[langchain/src/stores/message/in_memory.ts:11](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/stores/message/in_memory.ts#L11)

## Methods

### addAIChatMessage()

> **addAIChatMessage**(`message`: `string`): `Promise`<`void`\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `message` | `string` |

#### Returns

`Promise`<`void`\>

#### Overrides

[BaseChatMessageHistory](../../schema/classes/BaseChatMessageHistory.md).[addAIChatMessage](../../schema/classes/BaseChatMessageHistory.md#addaichatmessage)

#### Defined in

[langchain/src/stores/message/in_memory.ts:24](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/stores/message/in_memory.ts#L24)

### addUserMessage()

> **addUserMessage**(`message`: `string`): `Promise`<`void`\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `message` | `string` |

#### Returns

`Promise`<`void`\>

#### Overrides

[BaseChatMessageHistory](../../schema/classes/BaseChatMessageHistory.md).[addUserMessage](../../schema/classes/BaseChatMessageHistory.md#addusermessage)

#### Defined in

[langchain/src/stores/message/in_memory.ts:20](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/stores/message/in_memory.ts#L20)

### clear()

> **clear**(): `Promise`<`void`\>

#### Returns

`Promise`<`void`\>

#### Overrides

[BaseChatMessageHistory](../../schema/classes/BaseChatMessageHistory.md).[clear](../../schema/classes/BaseChatMessageHistory.md#clear)

#### Defined in

[langchain/src/stores/message/in_memory.ts:28](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/stores/message/in_memory.ts#L28)

### getMessages()

> **getMessages**(): `Promise`<[`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[]\>

#### Returns

`Promise`<[`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[]\>

#### Overrides

[BaseChatMessageHistory](../../schema/classes/BaseChatMessageHistory.md).[getMessages](../../schema/classes/BaseChatMessageHistory.md#getmessages)

#### Defined in

[langchain/src/stores/message/in_memory.ts:16](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/stores/message/in_memory.ts#L16)
