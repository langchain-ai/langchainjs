---
title: "BaseStringPromptTemplate"
---

# BaseStringPromptTemplate

Base class for prompt templates. Exposes a format method that returns a
string prompt given a set of input values.

## Hierarchy

- [`BasePromptTemplate`](BasePromptTemplate.md).**BaseStringPromptTemplate**

## Constructors

### constructor()

> **new BaseStringPromptTemplate**(`input`: [`BasePromptTemplateInput`](../interfaces/BasePromptTemplateInput.md)): [`BaseStringPromptTemplate`](BaseStringPromptTemplate.md)

#### Parameters

| Parameter | Type                                                                  |
| :-------- | :-------------------------------------------------------------------- |
| `input`   | [`BasePromptTemplateInput`](../interfaces/BasePromptTemplateInput.md) |

#### Returns

[`BaseStringPromptTemplate`](BaseStringPromptTemplate.md)

#### Inherited from

[BasePromptTemplate](BasePromptTemplate.md).[constructor](BasePromptTemplate.md#constructor)

#### Defined in

[langchain/src/prompts/base.ts:56](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L56)

## Properties

### inputVariables

> **inputVariables**: `string`[]

A list of variable names the prompt template expects

#### Inherited from

[BasePromptTemplate](BasePromptTemplate.md).[inputVariables](BasePromptTemplate.md#inputvariables)

#### Defined in

[langchain/src/prompts/base.ts:50](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L50)

### outputParser?

> **outputParser**: `BaseOutputParser`<`unknown`\>

How to parse the output of calling an LLM on this formatted prompt

#### Inherited from

[BasePromptTemplate](BasePromptTemplate.md).[outputParser](BasePromptTemplate.md#outputparser)

#### Defined in

[langchain/src/prompts/base.ts:52](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L52)

### partialVariables?

> **partialVariables**: [`InputValues`](../../schema/types/InputValues.md)

Partial variables

#### Inherited from

[BasePromptTemplate](BasePromptTemplate.md).[partialVariables](BasePromptTemplate.md#partialvariables)

#### Defined in

[langchain/src/prompts/base.ts:54](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L54)

## Methods

### \_getPromptType()

Return the string type key uniquely identifying this class of prompt template.

> `Abstract` **\_getPromptType**(): `string`

#### Returns

`string`

#### Inherited from

[BasePromptTemplate](BasePromptTemplate.md).[\_getPromptType](BasePromptTemplate.md#_getprompttype)

#### Defined in

[langchain/src/prompts/base.ts:109](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L109)

### format()

Format the prompt given the input values.

#### Example

```ts
prompt.format({ foo: "bar" });
```

> `Abstract` **format**(`values`: [`InputValues`](../../schema/types/InputValues.md)): `Promise`<`string`\>

#### Parameters

| Parameter | Type                                               | Description                                                    |
| :-------- | :------------------------------------------------- | :------------------------------------------------------------- |
| `values`  | [`InputValues`](../../schema/types/InputValues.md) | A dictionary of arguments to be passed to the prompt template. |

#### Returns

`Promise`<`string`\>

A formatted prompt string.

#### Inherited from

[BasePromptTemplate](BasePromptTemplate.md).[format](BasePromptTemplate.md#format)

#### Defined in

[langchain/src/prompts/base.ts:97](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L97)

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

#### Overrides

[BasePromptTemplate](BasePromptTemplate.md).[formatPromptValue](BasePromptTemplate.md#formatpromptvalue)

#### Defined in

[langchain/src/prompts/base.ts:151](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L151)

### mergePartialAndUserVariables()

> **mergePartialAndUserVariables**(`userVariables`: [`InputValues`](../../schema/types/InputValues.md)): `Promise`<[`InputValues`](../../schema/types/InputValues.md)\>

#### Parameters

| Parameter       | Type                                               |
| :-------------- | :------------------------------------------------- |
| `userVariables` | [`InputValues`](../../schema/types/InputValues.md) |

#### Returns

`Promise`<[`InputValues`](../../schema/types/InputValues.md)\>

#### Inherited from

[BasePromptTemplate](BasePromptTemplate.md).[mergePartialAndUserVariables](BasePromptTemplate.md#mergepartialanduservariables)

#### Defined in

[langchain/src/prompts/base.ts:68](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L68)

### partial()

> `Abstract` **partial**(`values`: [`PartialValues`](../../schema/types/PartialValues.md)): `Promise`<[`BasePromptTemplate`](BasePromptTemplate.md)\>

#### Parameters

| Parameter | Type                                                   |
| :-------- | :----------------------------------------------------- |
| `values`  | [`PartialValues`](../../schema/types/PartialValues.md) |

#### Returns

`Promise`<[`BasePromptTemplate`](BasePromptTemplate.md)\>

#### Inherited from

[BasePromptTemplate](BasePromptTemplate.md).[partial](BasePromptTemplate.md#partial)

#### Defined in

[langchain/src/prompts/base.ts:66](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L66)

### serialize()

Return a json-like object representing this prompt template.

> `Abstract` **serialize**(): [`SerializedBasePromptTemplate`](../types/SerializedBasePromptTemplate.md)

#### Returns

[`SerializedBasePromptTemplate`](../types/SerializedBasePromptTemplate.md)

#### Inherited from

[BasePromptTemplate](BasePromptTemplate.md).[serialize](BasePromptTemplate.md#serialize)

#### Defined in

[langchain/src/prompts/base.ts:114](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L114)

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

[BasePromptTemplate](BasePromptTemplate.md).[deserialize](BasePromptTemplate.md#deserialize)

#### Defined in

[langchain/src/prompts/base.ts:124](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L124)
