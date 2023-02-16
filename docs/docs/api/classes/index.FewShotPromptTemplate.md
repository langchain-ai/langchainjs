---
id: "index.FewShotPromptTemplate"
title: "Class: FewShotPromptTemplate"
sidebar_label: "FewShotPromptTemplate"
custom_edit_url: null
---

[index](../modules/).FewShotPromptTemplate

Prompt template that contains few-shot examples.

## Hierarchy

- [`BasePromptTemplate`](.BasePromptTemplate)

  ↳ **`FewShotPromptTemplate`**

## Implements

- [`FewShotPromptTemplateInput`](../interfaces/prompt.FewShotPromptTemplateInput.md)

## Constructors

### constructor

• **new FewShotPromptTemplate**(`input`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `input` | [`FewShotPromptTemplateInput`](../interfaces/prompt.FewShotPromptTemplateInput.md) |

#### Overrides

[BasePromptTemplate](.BasePromptTemplate).[constructor](.BasePromptTemplate#constructor)

#### Defined in

[prompt/few_shot.ts:109](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/few_shot.ts#L109)

## Properties

### examplePrompt

• **examplePrompt**: [`PromptTemplate`](.PromptTemplate)

An [PromptTemplate](.PromptTemplate) used to format a single example.

#### Implementation of

[FewShotPromptTemplateInput](../interfaces/prompt.FewShotPromptTemplateInput.md).[examplePrompt](../interfaces/prompt.FewShotPromptTemplateInput.md#exampleprompt)

#### Defined in

[prompt/few_shot.ts:97](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/few_shot.ts#L97)

___

### exampleSelector

• `Optional` **exampleSelector**: ``null``

An ExampleSelector Examples to format into the prompt. Exactly one of this or
[examples](.FewShotPromptTemplate#examples) must be
provided.

#### Implementation of

[FewShotPromptTemplateInput](../interfaces/prompt.FewShotPromptTemplateInput.md).[exampleSelector](../interfaces/prompt.FewShotPromptTemplateInput.md#exampleselector)

#### Defined in

[prompt/few_shot.ts:95](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/few_shot.ts#L95)

___

### exampleSeparator

• **exampleSeparator**: `string`

String separator used to join the prefix, the examples, and suffix.

#### Implementation of

[FewShotPromptTemplateInput](../interfaces/prompt.FewShotPromptTemplateInput.md).[exampleSeparator](../interfaces/prompt.FewShotPromptTemplateInput.md#exampleseparator)

#### Defined in

[prompt/few_shot.ts:101](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/few_shot.ts#L101)

___

### examples

• `Optional` **examples**: [`InputValues`](../modules/prompt.md#inputvalues)[]

Examples to format into the prompt. Exactly one of this or
[exampleSelector](.FewShotPromptTemplate#exampleselector) must be
provided.

#### Implementation of

[FewShotPromptTemplateInput](../interfaces/prompt.FewShotPromptTemplateInput.md).[examples](../interfaces/prompt.FewShotPromptTemplateInput.md#examples)

#### Defined in

[prompt/few_shot.ts:93](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/few_shot.ts#L93)

___

### inputVariables

• **inputVariables**: `string`[]

A list of variable names the prompt template expects

#### Implementation of

[FewShotPromptTemplateInput](../interfaces/prompt.FewShotPromptTemplateInput.md).[inputVariables](../interfaces/prompt.FewShotPromptTemplateInput.md#inputvariables)

#### Inherited from

[BasePromptTemplate](.BasePromptTemplate).[inputVariables](.BasePromptTemplate#inputvariables)

#### Defined in

[prompt/base.ts:34](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/base.ts#L34)

___

### outputParser

• `Optional` **outputParser**: [`BaseOutputParser`](.internal.BaseOutputParser)

How to parse the output of calling an LLM on this formatted prompt

#### Implementation of

[FewShotPromptTemplateInput](../interfaces/prompt.FewShotPromptTemplateInput.md).[outputParser](../interfaces/prompt.FewShotPromptTemplateInput.md#outputparser)

#### Inherited from

[BasePromptTemplate](.BasePromptTemplate).[outputParser](.BasePromptTemplate#outputparser)

#### Defined in

[prompt/base.ts:36](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/base.ts#L36)

___

### prefix

• **prefix**: `string`

A prompt template string to put before the examples.

**`Default Value`**

`""`

#### Implementation of

[FewShotPromptTemplateInput](../interfaces/prompt.FewShotPromptTemplateInput.md).[prefix](../interfaces/prompt.FewShotPromptTemplateInput.md#prefix)

#### Defined in

[prompt/few_shot.ts:103](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/few_shot.ts#L103)

___

### suffix

• **suffix**: `string`

A prompt template string to put after the examples.

#### Implementation of

[FewShotPromptTemplateInput](../interfaces/prompt.FewShotPromptTemplateInput.md).[suffix](../interfaces/prompt.FewShotPromptTemplateInput.md#suffix)

#### Defined in

[prompt/few_shot.ts:99](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/few_shot.ts#L99)

___

### templateFormat

• **templateFormat**: [`TemplateFormat`](../modules/.internal#templateformat) = `"f-string"`

The format of the prompt template. Options are: 'f-string', 'jinja-2'

#### Implementation of

[FewShotPromptTemplateInput](../interfaces/prompt.FewShotPromptTemplateInput.md).[templateFormat](../interfaces/prompt.FewShotPromptTemplateInput.md#templateformat)

#### Defined in

[prompt/few_shot.ts:105](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/few_shot.ts#L105)

___

### validateTemplate

• **validateTemplate**: `boolean` = `true`

Whether or not to try validating the template on initialization.

#### Implementation of

[FewShotPromptTemplateInput](../interfaces/prompt.FewShotPromptTemplateInput.md).[validateTemplate](../interfaces/prompt.FewShotPromptTemplateInput.md#validatetemplate)

#### Defined in

[prompt/few_shot.ts:107](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/few_shot.ts#L107)

## Methods

### \_getPromptType

▸ **_getPromptType**(): ``"few_shot"``

Return the string type key uniquely identifying this class of prompt template.

#### Returns

``"few_shot"``

#### Overrides

[BasePromptTemplate](.BasePromptTemplate).[_getPromptType](.BasePromptTemplate#_getprompttype)

#### Defined in

[prompt/few_shot.ts:134](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/few_shot.ts#L134)

___

### format

▸ **format**(`values`): `string`

Format the prompt given the input values.

**`Example`**

```ts
prompt.format({ foo: "bar" });
```

#### Parameters

| Name | Type |
| :------ | :------ |
| `values` | [`InputValues`](../modules/prompt.md#inputvalues) |

#### Returns

`string`

A formatted prompt string.

#### Overrides

[BasePromptTemplate](.BasePromptTemplate).[format](.BasePromptTemplate#format)

#### Defined in

[prompt/few_shot.ts:151](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/few_shot.ts#L151)

___

### getExamples

▸ `Private` **getExamples**(`_`): [`InputValues`](../modules/prompt.md#inputvalues)[]

#### Parameters

| Name | Type |
| :------ | :------ |
| `_` | [`InputValues`](../modules/prompt.md#inputvalues) |

#### Returns

[`InputValues`](../modules/prompt.md#inputvalues)[]

#### Defined in

[prompt/few_shot.ts:138](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/few_shot.ts#L138)

___

### serialize

▸ **serialize**(): [`SerializedFewShotTemplate`](../modules/prompt.md#serializedfewshottemplate)

Return a json-like object representing this prompt template.

#### Returns

[`SerializedFewShotTemplate`](../modules/prompt.md#serializedfewshottemplate)

#### Overrides

[BasePromptTemplate](.BasePromptTemplate).[serialize](.BasePromptTemplate#serialize)

#### Defined in

[prompt/few_shot.ts:163](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/few_shot.ts#L163)

___

### deserialize

▸ `Static` **deserialize**(`data`): `Promise`<[`FewShotPromptTemplate`](.FewShotPromptTemplate)\>

Load a prompt template from a json-like object describing it.

**`Remarks`**

Deserializing needs to be async because templates (e.g. [FewShotPromptTemplate](.FewShotPromptTemplate)) can
reference remote resources that we read asynchronously with a web
request.

#### Parameters

| Name | Type |
| :------ | :------ |
| `data` | [`SerializedFewShotTemplate`](../modules/prompt.md#serializedfewshottemplate) |

#### Returns

`Promise`<[`FewShotPromptTemplate`](.FewShotPromptTemplate)\>

#### Overrides

[BasePromptTemplate](.BasePromptTemplate).[deserialize](.BasePromptTemplate#deserialize)

#### Defined in

[prompt/few_shot.ts:182](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/few_shot.ts#L182)
