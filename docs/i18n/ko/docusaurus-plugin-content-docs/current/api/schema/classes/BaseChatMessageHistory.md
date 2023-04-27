---
title: "BaseChatMessageHistory"
---

# BaseChatMessageHistory

## Hierarchy

- [`ChatMessageHistory`](../../memory/classes/ChatMessageHistory.md)

## Constructors

### constructor()

> **new BaseChatMessageHistory**(): [`BaseChatMessageHistory`](BaseChatMessageHistory.md)

#### Returns

[`BaseChatMessageHistory`](BaseChatMessageHistory.md)

## Methods

### addAIChatMessage()

> `Abstract` **addAIChatMessage**(`message`: `string`): `Promise`<`void`\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `message` | `string` |

#### Returns

`Promise`<`void`\>

#### Defined in

[langchain/src/schema/index.ts:149](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/index.ts#L149)

### addUserMessage()

> `Abstract` **addUserMessage**(`message`: `string`): `Promise`<`void`\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `message` | `string` |

#### Returns

`Promise`<`void`\>

#### Defined in

[langchain/src/schema/index.ts:147](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/index.ts#L147)

### clear()

> `Abstract` **clear**(): `Promise`<`void`\>

#### Returns

`Promise`<`void`\>

#### Defined in

[langchain/src/schema/index.ts:151](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/index.ts#L151)

### getMessages()

> `Abstract` **getMessages**(): `Promise`<[`BaseChatMessage`](BaseChatMessage.md)[]\>

#### Returns

`Promise`<[`BaseChatMessage`](BaseChatMessage.md)[]\>

#### Defined in

[langchain/src/schema/index.ts:145](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/index.ts#L145)
