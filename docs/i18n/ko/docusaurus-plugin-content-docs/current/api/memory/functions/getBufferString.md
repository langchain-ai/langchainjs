---
title: "getBufferString()"
---

# getBufferString()

This function is used by memory classes to get a string representation
of the chat message history, based on the message content and role.

> **getBufferString**(`messages`: [`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[], `humanPrefix`: `string` = `"Human"`, `aiPrefix`: `string` = `"AI"`): `string`

## Parameters

| Parameter     | Type                                                           | Default value |
| :------------ | :------------------------------------------------------------- | :------------ |
| `messages`    | [`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[] | `undefined`   |
| `humanPrefix` | `string`                                                       | `"Human"`     |
| `aiPrefix`    | `string`                                                       | `"AI"`        |

## Returns

`string`

## Defined in

[langchain/src/memory/base.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/memory/base.ts#L42)
