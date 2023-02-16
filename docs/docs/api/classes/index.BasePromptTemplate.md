---
id: "index.BasePromptTemplate"
title: "Class: BasePromptTemplate"
sidebar_label: "BasePromptTemplate"
custom_edit_url: null
---

[index](../modules/).BasePromptTemplate

Base class for prompt templates. Exposes a format method that returns a
string prompt given a set of input values.

## Hierarchy

- **`BasePromptTemplate`**

  ↳ [`PromptTemplate`](.PromptTemplate)

  ↳ [`FewShotPromptTemplate`](.FewShotPromptTemplate)

## Implements

- [`BasePromptTemplateInput`](../interfaces/prompt.BasePromptTemplateInput.md)

## Constructors

### constructor

• **new BasePromptTemplate**(`input`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `input` | [`BasePromptTemplateInput`](../interfaces/prompt.BasePromptTemplateInput.md) |

#### Defined in

[prompt/base.ts:38](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/prompt/base.ts#L38)

## Properties

### inputVariables

• **inputVariables**: `string`[]

A list of variable names the prompt template expects

#### Implementation of

[BasePromptTemplateInput](../interfaces/prompt.BasePromptTemplateInput.md).[inputVariables](../interfaces/prompt.BasePromptTemplateInput.md#inputvariables)

#### Defined in

[prompt/base.ts:34](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/prompt/base.ts#L34)

___

### outputParser

• `Optional` **outputParser**: [`BaseOutputParser`](.internal.BaseOutputParser)

How to parse the output of calling an LLM on this formatted prompt

#### Implementation of

[BasePromptTemplateInput](../interfaces/prompt.BasePromptTemplateInput.md).[outputParser](../interfaces/prompt.BasePromptTemplateInput.md#outputparser)

#### Defined in

[prompt/base.ts:36](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/prompt/base.ts#L36)

## Methods

### \_getPromptType

▸ `Abstract` **_getPromptType**(): `string`

Return the string type key uniquely identifying this class of prompt template.

#### Returns

`string`

#### Defined in

[prompt/base.ts:64](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/prompt/base.ts#L64)

___

### format

▸ `Abstract` **format**(`values`): `string`

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

#### Defined in

[prompt/base.ts:59](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/prompt/base.ts#L59)

___

### serialize

▸ `Abstract` **serialize**(): [`SerializedBasePromptTemplate`](../modules/prompt.md#serializedbaseprompttemplate)

Return a json-like object representing this prompt template.

#### Returns

[`SerializedBasePromptTemplate`](../modules/prompt.md#serializedbaseprompttemplate)

#### Defined in

[prompt/base.ts:69](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/prompt/base.ts#L69)

___

### deserialize

▸ `Static` **deserialize**(`data`): `Promise`<[`BasePromptTemplate`](.BasePromptTemplate)\>

Load a prompt template from a json-like object describing it.

**`Remarks`**

Deserializing needs to be async because templates (e.g. [FewShotPromptTemplate](.FewShotPromptTemplate)) can
reference remote resources that we read asynchronously with a web
request.

#### Parameters

| Name | Type |
| :------ | :------ |
| `data` | [`SerializedBasePromptTemplate`](../modules/prompt.md#serializedbaseprompttemplate) |

#### Returns

`Promise`<[`BasePromptTemplate`](.BasePromptTemplate)\>

#### Defined in

[prompt/base.ts:79](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/prompt/base.ts#L79)
