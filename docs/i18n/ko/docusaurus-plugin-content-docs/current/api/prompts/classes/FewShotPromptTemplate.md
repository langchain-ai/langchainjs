---
title: "FewShotPromptTemplate"
---

# FewShotPromptTemplate

Prompt template that contains few-shot examples.

## Hierarchy

- [`BaseStringPromptTemplate`](BaseStringPromptTemplate.md).**FewShotPromptTemplate**

## Implements

- [`FewShotPromptTemplateInput`](../interfaces/FewShotPromptTemplateInput.md)

## Constructors

### constructor()

> **new FewShotPromptTemplate**(`input`: [`FewShotPromptTemplateInput`](../interfaces/FewShotPromptTemplateInput.md)): [`FewShotPromptTemplate`](FewShotPromptTemplate.md)

#### Parameters

| Parameter | Type                                                                        |
| :-------- | :-------------------------------------------------------------------------- |
| `input`   | [`FewShotPromptTemplateInput`](../interfaces/FewShotPromptTemplateInput.md) |

#### Returns

[`FewShotPromptTemplate`](FewShotPromptTemplate.md)

#### Overrides

[BaseStringPromptTemplate](BaseStringPromptTemplate.md).[constructor](BaseStringPromptTemplate.md#constructor)

#### Defined in

[langchain/src/prompts/few_shot.ts:88](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/few_shot.ts#L88)

## Properties

### examplePrompt

> **examplePrompt**: [`PromptTemplate`](PromptTemplate.md)

An [PromptTemplate](PromptTemplate.md) used to format a single example.

#### Implementation of

[FewShotPromptTemplateInput](../interfaces/FewShotPromptTemplateInput.md).[examplePrompt](../interfaces/FewShotPromptTemplateInput.md#exampleprompt)

#### Defined in

[langchain/src/prompts/few_shot.ts:76](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/few_shot.ts#L76)

### exampleSeparator

> **exampleSeparator**: `string` = `"\n\n"`

String separator used to join the prefix, the examples, and suffix.

#### Implementation of

[FewShotPromptTemplateInput](../interfaces/FewShotPromptTemplateInput.md).[exampleSeparator](../interfaces/FewShotPromptTemplateInput.md#exampleseparator)

#### Defined in

[langchain/src/prompts/few_shot.ts:80](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/few_shot.ts#L80)

### inputVariables

> **inputVariables**: `string`[]

A list of variable names the prompt template expects

#### Implementation of

[FewShotPromptTemplateInput](../interfaces/FewShotPromptTemplateInput.md).[inputVariables](../interfaces/FewShotPromptTemplateInput.md#inputvariables)

#### Inherited from

[BaseStringPromptTemplate](BaseStringPromptTemplate.md).[inputVariables](BaseStringPromptTemplate.md#inputvariables)

#### Defined in

[langchain/src/prompts/base.ts:50](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L50)

### prefix

> **prefix**: `string` = `""`

A prompt template string to put before the examples.

#### Default Value

`""`

#### Implementation of

[FewShotPromptTemplateInput](../interfaces/FewShotPromptTemplateInput.md).[prefix](../interfaces/FewShotPromptTemplateInput.md#prefix)

#### Defined in

[langchain/src/prompts/few_shot.ts:82](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/few_shot.ts#L82)

### suffix

> **suffix**: `string` = `""`

A prompt template string to put after the examples.

#### Implementation of

[FewShotPromptTemplateInput](../interfaces/FewShotPromptTemplateInput.md).[suffix](../interfaces/FewShotPromptTemplateInput.md#suffix)

#### Defined in

[langchain/src/prompts/few_shot.ts:78](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/few_shot.ts#L78)

### templateFormat

> **templateFormat**: [`TemplateFormat`](../types/TemplateFormat.md) = `"f-string"`

The format of the prompt template. Options are: 'f-string', 'jinja-2'

#### Implementation of

[FewShotPromptTemplateInput](../interfaces/FewShotPromptTemplateInput.md).[templateFormat](../interfaces/FewShotPromptTemplateInput.md#templateformat)

#### Defined in

[langchain/src/prompts/few_shot.ts:84](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/few_shot.ts#L84)

### validateTemplate

> **validateTemplate**: `boolean` = `true`

Whether or not to try validating the template on initialization.

#### Implementation of

[FewShotPromptTemplateInput](../interfaces/FewShotPromptTemplateInput.md).[validateTemplate](../interfaces/FewShotPromptTemplateInput.md#validatetemplate)

#### Defined in

[langchain/src/prompts/few_shot.ts:86](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/few_shot.ts#L86)

### exampleSelector?

> **exampleSelector**: [`BaseExampleSelector`](BaseExampleSelector.md)

An [BaseExampleSelector](BaseExampleSelector.md) Examples to format into the prompt. Exactly one of this or
[examples](../interfaces/FewShotPromptTemplateInput.md#examples) must be
provided.

#### Implementation of

[FewShotPromptTemplateInput](../interfaces/FewShotPromptTemplateInput.md).[exampleSelector](../interfaces/FewShotPromptTemplateInput.md#exampleselector)

#### Defined in

[langchain/src/prompts/few_shot.ts:74](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/few_shot.ts#L74)

### examples?

> **examples**: [`InputValues`](../../schema/types/InputValues.md)[]

Examples to format into the prompt. Exactly one of this or
[exampleSelector](../interfaces/FewShotPromptTemplateInput.md#exampleselector) must be
provided.

#### Implementation of

[FewShotPromptTemplateInput](../interfaces/FewShotPromptTemplateInput.md).[examples](../interfaces/FewShotPromptTemplateInput.md#examples)

#### Defined in

[langchain/src/prompts/few_shot.ts:72](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/few_shot.ts#L72)

### outputParser?

> **outputParser**: `BaseOutputParser`<`unknown`\>

How to parse the output of calling an LLM on this formatted prompt

#### Implementation of

[FewShotPromptTemplateInput](../interfaces/FewShotPromptTemplateInput.md).[outputParser](../interfaces/FewShotPromptTemplateInput.md#outputparser)

#### Inherited from

[BaseStringPromptTemplate](BaseStringPromptTemplate.md).[outputParser](BaseStringPromptTemplate.md#outputparser)

#### Defined in

[langchain/src/prompts/base.ts:52](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L52)

### partialVariables?

> **partialVariables**: [`InputValues`](../../schema/types/InputValues.md)

Partial variables

#### Implementation of

[FewShotPromptTemplateInput](../interfaces/FewShotPromptTemplateInput.md).[partialVariables](../interfaces/FewShotPromptTemplateInput.md#partialvariables)

#### Inherited from

[BaseStringPromptTemplate](BaseStringPromptTemplate.md).[partialVariables](BaseStringPromptTemplate.md#partialvariables)

#### Defined in

[langchain/src/prompts/base.ts:54](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L54)

## Methods

### \_getPromptType()

Return the string type key uniquely identifying this class of prompt template.

> **\_getPromptType**(): "few_shot"

#### Returns

"few_shot"

#### Overrides

[BaseStringPromptTemplate](BaseStringPromptTemplate.md).[\_getPromptType](BaseStringPromptTemplate.md#_getprompttype)

#### Defined in

[langchain/src/prompts/few_shot.ts:119](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/few_shot.ts#L119)

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

#### Overrides

[BaseStringPromptTemplate](BaseStringPromptTemplate.md).[format](BaseStringPromptTemplate.md#format)

#### Defined in

[langchain/src/prompts/few_shot.ts:150](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/few_shot.ts#L150)

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

[BaseStringPromptTemplate](BaseStringPromptTemplate.md).[formatPromptValue](BaseStringPromptTemplate.md#formatpromptvalue)

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

[BaseStringPromptTemplate](BaseStringPromptTemplate.md).[mergePartialAndUserVariables](BaseStringPromptTemplate.md#mergepartialanduservariables)

#### Defined in

[langchain/src/prompts/base.ts:68](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L68)

### partial()

> **partial**(`values`: [`PartialValues`](../../schema/types/PartialValues.md)): `Promise`<[`FewShotPromptTemplate`](FewShotPromptTemplate.md)\>

#### Parameters

| Parameter | Type                                                   |
| :-------- | :----------------------------------------------------- |
| `values`  | [`PartialValues`](../../schema/types/PartialValues.md) |

#### Returns

`Promise`<[`FewShotPromptTemplate`](FewShotPromptTemplate.md)\>

#### Overrides

[BaseStringPromptTemplate](BaseStringPromptTemplate.md).[partial](BaseStringPromptTemplate.md#partial)

#### Defined in

[langchain/src/prompts/few_shot.ts:138](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/few_shot.ts#L138)

### serialize()

Return a json-like object representing this prompt template.

> **serialize**(): [`SerializedFewShotTemplate`](../types/SerializedFewShotTemplate.md)

#### Returns

[`SerializedFewShotTemplate`](../types/SerializedFewShotTemplate.md)

#### Overrides

[BaseStringPromptTemplate](BaseStringPromptTemplate.md).[serialize](BaseStringPromptTemplate.md#serialize)

#### Defined in

[langchain/src/prompts/few_shot.ts:163](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/few_shot.ts#L163)

### deserialize()

Load a prompt template from a json-like object describing it.

#### Remarks

Deserializing needs to be async because templates (e.g. [FewShotPromptTemplate](FewShotPromptTemplate.md)) can
reference remote resources that we read asynchronously with a web
request.

> `Static` **deserialize**(`data`: [`SerializedFewShotTemplate`](../types/SerializedFewShotTemplate.md)): `Promise`<[`FewShotPromptTemplate`](FewShotPromptTemplate.md)\>

#### Parameters

| Parameter | Type                                                                 |
| :-------- | :------------------------------------------------------------------- |
| `data`    | [`SerializedFewShotTemplate`](../types/SerializedFewShotTemplate.md) |

#### Returns

`Promise`<[`FewShotPromptTemplate`](FewShotPromptTemplate.md)\>

#### Overrides

[BaseStringPromptTemplate](BaseStringPromptTemplate.md).[deserialize](BaseStringPromptTemplate.md#deserialize)

#### Defined in

[langchain/src/prompts/few_shot.ts:186](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/few_shot.ts#L186)
