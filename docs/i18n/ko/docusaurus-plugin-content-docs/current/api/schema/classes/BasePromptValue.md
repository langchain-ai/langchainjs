---
title: "BasePromptValue"
---

# BasePromptValue

Base PromptValue class. All prompt values should extend this class.

## Constructors

### constructor()

> **new BasePromptValue**(): [`BasePromptValue`](BasePromptValue.md)

#### Returns

[`BasePromptValue`](BasePromptValue.md)

## Methods

### toChatMessages()

> `Abstract` **toChatMessages**(): [`BaseChatMessage`](BaseChatMessage.md)[]

#### Returns

[`BaseChatMessage`](BaseChatMessage.md)[]

#### Defined in

[langchain/src/schema/index.ts:115](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/index.ts#L115)

### toString()

> `Abstract` **toString**(): `string`

#### Returns

`string`

#### Defined in

[langchain/src/schema/index.ts:113](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/index.ts#L113)
