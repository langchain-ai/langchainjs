---
title: "ChatPromptTemplate"
---

# ChatPromptTemplate

Base class for prompt templates. Exposes a format method that returns a
string prompt given a set of input values.

## Hierarchy

- [`BaseChatPromptTemplate`](BaseChatPromptTemplate.md).**ChatPromptTemplate**

## Implements

- `ChatPromptTemplateInput`

## Constructors

### constructor()

> **new ChatPromptTemplate**(`input`: `ChatPromptTemplateInput`): [`ChatPromptTemplate`](ChatPromptTemplate.md)

#### Parameters

| Parameter | Type                      |
| :-------- | :------------------------ |
| `input`   | `ChatPromptTemplateInput` |

#### Returns

[`ChatPromptTemplate`](ChatPromptTemplate.md)

#### Overrides

[BaseChatPromptTemplate](BaseChatPromptTemplate.md).[constructor](BaseChatPromptTemplate.md#constructor)

#### Defined in

[langchain/src/prompts/chat.ts:186](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/chat.ts#L186)

## Properties

### inputVariables

> **inputVariables**: `string`[]

A list of variable names the prompt template expects

#### Implementation of

ChatPromptTemplateInput.inputVariables

#### Inherited from

[BaseChatPromptTemplate](BaseChatPromptTemplate.md).[inputVariables](BaseChatPromptTemplate.md#inputvariables)

#### Defined in

[langchain/src/prompts/base.ts:50](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L50)

### promptMessages

> **promptMessages**: `BaseMessagePromptTemplate`[]

#### Implementation of

ChatPromptTemplateInput.promptMessages

#### Defined in

[langchain/src/prompts/chat.ts:182](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/chat.ts#L182)

### validateTemplate

> **validateTemplate**: `boolean` = `true`

#### Implementation of

ChatPromptTemplateInput.validateTemplate

#### Defined in

[langchain/src/prompts/chat.ts:184](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/chat.ts#L184)

### outputParser?

> **outputParser**: `BaseOutputParser`<`unknown`\>

How to parse the output of calling an LLM on this formatted prompt

#### Implementation of

ChatPromptTemplateInput.outputParser

#### Inherited from

[BaseChatPromptTemplate](BaseChatPromptTemplate.md).[outputParser](BaseChatPromptTemplate.md#outputparser)

#### Defined in

[langchain/src/prompts/base.ts:52](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L52)

### partialVariables?

> **partialVariables**: [`InputValues`](../../schema/types/InputValues.md)

Partial variables

#### Implementation of

ChatPromptTemplateInput.partialVariables

#### Inherited from

[BaseChatPromptTemplate](BaseChatPromptTemplate.md).[partialVariables](BaseChatPromptTemplate.md#partialvariables)

#### Defined in

[langchain/src/prompts/base.ts:54](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L54)

## Methods

### \_getPromptType()

Return the string type key uniquely identifying this class of prompt template.

> **\_getPromptType**(): "chat"

#### Returns

"chat"

#### Overrides

[BaseChatPromptTemplate](BaseChatPromptTemplate.md).[\_getPromptType](BaseChatPromptTemplate.md#_getprompttype)

#### Defined in

[langchain/src/prompts/chat.ts:229](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/chat.ts#L229)

### format()

Format the prompt given the input values.

#### Example

```ts
prompt.format({ foo: "bar" });
```

> **format**(`values`: [`InputValues`](../../schema/types/InputValues.md)): `Promise`<`string`\>

#### Parameters

| Parameter | Type                                               | Description                                                    |
| :-------- | :------------------------------------------------- | :------------------------------------------------------------- |
| `values`  | [`InputValues`](../../schema/types/InputValues.md) | A dictionary of arguments to be passed to the prompt template. |

#### Returns

`Promise`<`string`\>

A formatted prompt string.

#### Inherited from

[BaseChatPromptTemplate](BaseChatPromptTemplate.md).[format](BaseChatPromptTemplate.md#format)

#### Defined in

[langchain/src/prompts/chat.ts:95](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/chat.ts#L95)

### formatMessages()

> **formatMessages**(`values`: [`InputValues`](../../schema/types/InputValues.md)): `Promise`<[`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[]\>

#### Parameters

| Parameter | Type                                               |
| :-------- | :------------------------------------------------- |
| `values`  | [`InputValues`](../../schema/types/InputValues.md) |

#### Returns

`Promise`<[`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[]\>

#### Overrides

[BaseChatPromptTemplate](BaseChatPromptTemplate.md).[formatMessages](BaseChatPromptTemplate.md#formatmessages)

#### Defined in

[langchain/src/prompts/chat.ts:233](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/chat.ts#L233)

### formatPromptValue()

Format the prompt given the input values and return a formatted prompt value.

> **formatPromptValue**(`values`: [`InputValues`](../../schema/types/InputValues.md)): `Promise`<[`BasePromptValue`](../../schema/classes/BasePromptValue.md)\>

#### Parameters

| Parameter | Type                                               |
| :-------- | :------------------------------------------------- |
| `values`  | [`InputValues`](../../schema/types/InputValues.md) |

#### Returns

`Promise`<[`BasePromptValue`](../../schema/classes/BasePromptValue.md)\>

A formatted PromptValue.

#### Inherited from

[BaseChatPromptTemplate](BaseChatPromptTemplate.md).[formatPromptValue](BaseChatPromptTemplate.md#formatpromptvalue)

#### Defined in

[langchain/src/prompts/chat.ts:99](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/chat.ts#L99)

### mergePartialAndUserVariables()

> **mergePartialAndUserVariables**(`userVariables`: [`InputValues`](../../schema/types/InputValues.md)): `Promise`<[`InputValues`](../../schema/types/InputValues.md)\>

#### Parameters

| Parameter       | Type                                               |
| :-------------- | :------------------------------------------------- |
| `userVariables` | [`InputValues`](../../schema/types/InputValues.md) |

#### Returns

`Promise`<[`InputValues`](../../schema/types/InputValues.md)\>

#### Inherited from

[BaseChatPromptTemplate](BaseChatPromptTemplate.md).[mergePartialAndUserVariables](BaseChatPromptTemplate.md#mergepartialanduservariables)

#### Defined in

[langchain/src/prompts/base.ts:68](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L68)

### partial()

> **partial**(`values`: [`PartialValues`](../../schema/types/PartialValues.md)): `Promise`<[`ChatPromptTemplate`](ChatPromptTemplate.md)\>

#### Parameters

| Parameter | Type                                                   |
| :-------- | :----------------------------------------------------- |
| `values`  | [`PartialValues`](../../schema/types/PartialValues.md) |

#### Returns

`Promise`<[`ChatPromptTemplate`](ChatPromptTemplate.md)\>

#### Overrides

[BaseChatPromptTemplate](BaseChatPromptTemplate.md).[partial](BaseChatPromptTemplate.md#partial)

#### Defined in

[langchain/src/prompts/chat.ts:269](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/chat.ts#L269)

### serialize()

Return a json-like object representing this prompt template.

> **serialize**(): [`SerializedChatPromptTemplate`](../types/SerializedChatPromptTemplate.md)

#### Returns

[`SerializedChatPromptTemplate`](../types/SerializedChatPromptTemplate.md)

#### Overrides

[BaseChatPromptTemplate](BaseChatPromptTemplate.md).[serialize](BaseChatPromptTemplate.md#serialize)

#### Defined in

[langchain/src/prompts/chat.ts:257](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/chat.ts#L257)

### deserialize()

Load a prompt template from a json-like object describing it.

#### Remarks

Deserializing needs to be async because templates (e.g. [FewShotPromptTemplate](FewShotPromptTemplate.md)) can
reference remote resources that we read asynchronously with a web
request.

> `Static` **deserialize**(`data`: [`SerializedBasePromptTemplate`](../types/SerializedBasePromptTemplate.md)): `Promise`<[`BasePromptTemplate`](BasePromptTemplate.md)\>

#### Parameters

| Parameter | Type                                                                       |
| :-------- | :------------------------------------------------------------------------- |
| `data`    | [`SerializedBasePromptTemplate`](../types/SerializedBasePromptTemplate.md) |

#### Returns

`Promise`<[`BasePromptTemplate`](BasePromptTemplate.md)\>

#### Inherited from

[BaseChatPromptTemplate](BaseChatPromptTemplate.md).[deserialize](BaseChatPromptTemplate.md#deserialize)

#### Defined in

[langchain/src/prompts/base.ts:124](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L124)

### fromPromptMessages()

> `Static` **fromPromptMessages**(`promptMessages`: (`BaseMessagePromptTemplate` \| [`ChatPromptTemplate`](ChatPromptTemplate.md))[]): [`ChatPromptTemplate`](ChatPromptTemplate.md)

#### Parameters

| Parameter        | Type                                                                             |
| :--------------- | :------------------------------------------------------------------------------- |
| `promptMessages` | (`BaseMessagePromptTemplate` \| [`ChatPromptTemplate`](ChatPromptTemplate.md))[] |

#### Returns

[`ChatPromptTemplate`](ChatPromptTemplate.md)

#### Defined in

[langchain/src/prompts/chat.ts:283](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/chat.ts#L283)
