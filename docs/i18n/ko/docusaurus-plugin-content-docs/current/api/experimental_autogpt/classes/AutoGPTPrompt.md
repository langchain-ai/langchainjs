---
title: "AutoGPTPrompt"
---

# AutoGPTPrompt

Base class for prompt templates. Exposes a format method that returns a
string prompt given a set of input values.

## Hierarchy

- [`BaseChatPromptTemplate`](../../prompts/classes/BaseChatPromptTemplate.md).**AutoGPTPrompt**

## Implements

- [`AutoGPTPromptInput`](../interfaces/AutoGPTPromptInput.md)

## Constructors

### constructor()

> **new AutoGPTPrompt**(`fields`: [`AutoGPTPromptInput`](../interfaces/AutoGPTPromptInput.md)): [`AutoGPTPrompt`](AutoGPTPrompt.md)

#### Parameters

| Parameter | Type                                                        |
| :-------- | :---------------------------------------------------------- |
| `fields`  | [`AutoGPTPromptInput`](../interfaces/AutoGPTPromptInput.md) |

#### Returns

[`AutoGPTPrompt`](AutoGPTPrompt.md)

#### Overrides

[BaseChatPromptTemplate](../../prompts/classes/BaseChatPromptTemplate.md).[constructor](../../prompts/classes/BaseChatPromptTemplate.md#constructor)

#### Defined in

[langchain/src/experimental/autogpt/prompt.ts:36](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/autogpt/prompt.ts#L36)

## Properties

### aiName

> **aiName**: `string`

#### Implementation of

[AutoGPTPromptInput](../interfaces/AutoGPTPromptInput.md).[aiName](../interfaces/AutoGPTPromptInput.md#ainame)

#### Defined in

[langchain/src/experimental/autogpt/prompt.ts:26](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/autogpt/prompt.ts#L26)

### aiRole

> **aiRole**: `string`

#### Implementation of

[AutoGPTPromptInput](../interfaces/AutoGPTPromptInput.md).[aiRole](../interfaces/AutoGPTPromptInput.md#airole)

#### Defined in

[langchain/src/experimental/autogpt/prompt.ts:28](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/autogpt/prompt.ts#L28)

### inputVariables

> **inputVariables**: `string`[]

A list of variable names the prompt template expects

#### Inherited from

[BaseChatPromptTemplate](../../prompts/classes/BaseChatPromptTemplate.md).[inputVariables](../../prompts/classes/BaseChatPromptTemplate.md#inputvariables)

#### Defined in

[langchain/src/prompts/base.ts:50](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L50)

### sendTokenLimit

> **sendTokenLimit**: `number`

#### Implementation of

[AutoGPTPromptInput](../interfaces/AutoGPTPromptInput.md).[sendTokenLimit](../interfaces/AutoGPTPromptInput.md#sendtokenlimit)

#### Defined in

[langchain/src/experimental/autogpt/prompt.ts:34](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/autogpt/prompt.ts#L34)

### tokenCounter

> **tokenCounter**: `Function`

#### Type declaration

> (`text`: `string`): `Promise`<`number`\>

##### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `text`    | `string` |

##### Returns

`Promise`<`number`\>

#### Implementation of

[AutoGPTPromptInput](../interfaces/AutoGPTPromptInput.md).[tokenCounter](../interfaces/AutoGPTPromptInput.md#tokencounter)

#### Defined in

[langchain/src/experimental/autogpt/prompt.ts:32](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/autogpt/prompt.ts#L32)

### tools

> **tools**: `ObjectTool`[]

#### Implementation of

[AutoGPTPromptInput](../interfaces/AutoGPTPromptInput.md).[tools](../interfaces/AutoGPTPromptInput.md#tools)

#### Defined in

[langchain/src/experimental/autogpt/prompt.ts:30](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/autogpt/prompt.ts#L30)

### outputParser?

> **outputParser**: `BaseOutputParser`<`unknown`\>

How to parse the output of calling an LLM on this formatted prompt

#### Inherited from

[BaseChatPromptTemplate](../../prompts/classes/BaseChatPromptTemplate.md).[outputParser](../../prompts/classes/BaseChatPromptTemplate.md#outputparser)

#### Defined in

[langchain/src/prompts/base.ts:52](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L52)

### partialVariables?

> **partialVariables**: [`InputValues`](../../schema/types/InputValues.md)

Partial variables

#### Inherited from

[BaseChatPromptTemplate](../../prompts/classes/BaseChatPromptTemplate.md).[partialVariables](../../prompts/classes/BaseChatPromptTemplate.md#partialvariables)

#### Defined in

[langchain/src/prompts/base.ts:54](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L54)

## Methods

### \_getPromptType()

Return the string type key uniquely identifying this class of prompt template.

> **\_getPromptType**(): "autogpt"

#### Returns

"autogpt"

#### Overrides

[BaseChatPromptTemplate](../../prompts/classes/BaseChatPromptTemplate.md).[\_getPromptType](../../prompts/classes/BaseChatPromptTemplate.md#_getprompttype)

#### Defined in

[langchain/src/experimental/autogpt/prompt.ts:45](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/autogpt/prompt.ts#L45)

### constructFullPrompt()

> **constructFullPrompt**(`goals`: `string`[]): `string`

#### Parameters

| Parameter | Type       |
| :-------- | :--------- |
| `goals`   | `string`[] |

#### Returns

`string`

#### Defined in

[langchain/src/experimental/autogpt/prompt.ts:49](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/autogpt/prompt.ts#L49)

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

[BaseChatPromptTemplate](../../prompts/classes/BaseChatPromptTemplate.md).[format](../../prompts/classes/BaseChatPromptTemplate.md#format)

#### Defined in

[langchain/src/prompts/chat.ts:95](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/chat.ts#L95)

### formatMessages()

> **formatMessages**(«destructured»: `object`): `Promise`<[`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[]\>

#### Parameters

| Parameter        | Type                                                                                                                                                 |
| :--------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| `«destructured»` | `object`                                                                                                                                             |
| › `goals`        | `string`[]                                                                                                                                           |
| › `memory`       | [`VectorStoreRetriever`](../../vectorstores_base/classes/VectorStoreRetriever.md)<[`VectorStore`](../../vectorstores_base/classes/VectorStore.md)\> |
| › `messages`     | [`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[]                                                                                       |
| › `user_input`   | `string`                                                                                                                                             |

#### Returns

`Promise`<[`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[]\>

#### Overrides

[BaseChatPromptTemplate](../../prompts/classes/BaseChatPromptTemplate.md).[formatMessages](../../prompts/classes/BaseChatPromptTemplate.md#formatmessages)

#### Defined in

[langchain/src/experimental/autogpt/prompt.ts:65](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/autogpt/prompt.ts#L65)

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

[BaseChatPromptTemplate](../../prompts/classes/BaseChatPromptTemplate.md).[formatPromptValue](../../prompts/classes/BaseChatPromptTemplate.md#formatpromptvalue)

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

[BaseChatPromptTemplate](../../prompts/classes/BaseChatPromptTemplate.md).[mergePartialAndUserVariables](../../prompts/classes/BaseChatPromptTemplate.md#mergepartialanduservariables)

#### Defined in

[langchain/src/prompts/base.ts:68](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L68)

### partial()

> **partial**(`_values`: [`PartialValues`](../../schema/types/PartialValues.md)): `Promise`<[`BasePromptTemplate`](../../prompts/classes/BasePromptTemplate.md)\>

#### Parameters

| Parameter | Type                                                   |
| :-------- | :----------------------------------------------------- |
| `_values` | [`PartialValues`](../../schema/types/PartialValues.md) |

#### Returns

`Promise`<[`BasePromptTemplate`](../../prompts/classes/BasePromptTemplate.md)\>

#### Overrides

[BaseChatPromptTemplate](../../prompts/classes/BaseChatPromptTemplate.md).[partial](../../prompts/classes/BaseChatPromptTemplate.md#partial)

#### Defined in

[langchain/src/experimental/autogpt/prompt.ts:127](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/autogpt/prompt.ts#L127)

### serialize()

Return a json-like object representing this prompt template.

> **serialize**(): [`SerializedBasePromptTemplate`](../../prompts/types/SerializedBasePromptTemplate.md)

#### Returns

[`SerializedBasePromptTemplate`](../../prompts/types/SerializedBasePromptTemplate.md)

#### Overrides

[BaseChatPromptTemplate](../../prompts/classes/BaseChatPromptTemplate.md).[serialize](../../prompts/classes/BaseChatPromptTemplate.md#serialize)

#### Defined in

[langchain/src/experimental/autogpt/prompt.ts:131](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/autogpt/prompt.ts#L131)

### deserialize()

Load a prompt template from a json-like object describing it.

#### Remarks

Deserializing needs to be async because templates (e.g. FewShotPromptTemplate) can
reference remote resources that we read asynchronously with a web
request.

> `Static` **deserialize**(`data`: [`SerializedBasePromptTemplate`](../../prompts/types/SerializedBasePromptTemplate.md)): `Promise`<[`BasePromptTemplate`](../../prompts/classes/BasePromptTemplate.md)\>

#### Parameters

| Parameter | Type                                                                                  |
| :-------- | :------------------------------------------------------------------------------------ |
| `data`    | [`SerializedBasePromptTemplate`](../../prompts/types/SerializedBasePromptTemplate.md) |

#### Returns

`Promise`<[`BasePromptTemplate`](../../prompts/classes/BasePromptTemplate.md)\>

#### Inherited from

[BaseChatPromptTemplate](../../prompts/classes/BaseChatPromptTemplate.md).[deserialize](../../prompts/classes/BaseChatPromptTemplate.md#deserialize)

#### Defined in

[langchain/src/prompts/base.ts:124](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L124)
