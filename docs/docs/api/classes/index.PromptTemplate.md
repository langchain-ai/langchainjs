---
id: "index.PromptTemplate"
title: "Class: PromptTemplate"
sidebar_label: "PromptTemplate"
custom_edit_url: null
---

[index](../modules/).PromptTemplate

Schema to represent a basic prompt for an LLM.

**`Example`**

```ts
import { PromptTemplate } from "@langchain/prompt";

const prompt = new PromptTemplate({
  inputVariables: ["foo"],
  template: "Say {foo}",
});
```

## Hierarchy

- [`BasePromptTemplate`](.BasePromptTemplate)

  ↳ **`PromptTemplate`**

## Implements

- [`PromptTemplateInput`](../interfaces/prompt.PromptTemplateInput.md)

## Constructors

### constructor

• **new PromptTemplate**(`input`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `input` | [`PromptTemplateInput`](../interfaces/prompt.PromptTemplateInput.md) |

#### Overrides

[BasePromptTemplate](.BasePromptTemplate).[constructor](.BasePromptTemplate#constructor)

#### Defined in

[prompt/prompt.ts:74](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/prompt.ts#L74)

## Properties

### inputVariables

• **inputVariables**: `string`[]

A list of variable names the prompt template expects

#### Implementation of

[PromptTemplateInput](../interfaces/prompt.PromptTemplateInput.md).[inputVariables](../interfaces/prompt.PromptTemplateInput.md#inputvariables)

#### Inherited from

[BasePromptTemplate](.BasePromptTemplate).[inputVariables](.BasePromptTemplate#inputvariables)

#### Defined in

[prompt/base.ts:34](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/base.ts#L34)

___

### outputParser

• `Optional` **outputParser**: [`BaseOutputParser`](.internal.BaseOutputParser)

How to parse the output of calling an LLM on this formatted prompt

#### Implementation of

[PromptTemplateInput](../interfaces/prompt.PromptTemplateInput.md).[outputParser](../interfaces/prompt.PromptTemplateInput.md#outputparser)

#### Inherited from

[BasePromptTemplate](.BasePromptTemplate).[outputParser](.BasePromptTemplate#outputparser)

#### Defined in

[prompt/base.ts:36](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/base.ts#L36)

___

### template

• **template**: `string`

The propmt template

#### Implementation of

[PromptTemplateInput](../interfaces/prompt.PromptTemplateInput.md).[template](../interfaces/prompt.PromptTemplateInput.md#template)

#### Defined in

[prompt/prompt.ts:68](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/prompt.ts#L68)

___

### templateFormat

• **templateFormat**: [`TemplateFormat`](../modules/.internal#templateformat) = `"f-string"`

The format of the prompt template. Options are 'f-string', 'jinja-2'

**`Default Value`**

'f-string'

#### Implementation of

[PromptTemplateInput](../interfaces/prompt.PromptTemplateInput.md).[templateFormat](../interfaces/prompt.PromptTemplateInput.md#templateformat)

#### Defined in

[prompt/prompt.ts:70](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/prompt.ts#L70)

___

### validateTemplate

• **validateTemplate**: `boolean` = `true`

Whether or not to try validating the template on initialization

**`Default Value`**

`true`

#### Implementation of

[PromptTemplateInput](../interfaces/prompt.PromptTemplateInput.md).[validateTemplate](../interfaces/prompt.PromptTemplateInput.md#validatetemplate)

#### Defined in

[prompt/prompt.ts:72](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/prompt.ts#L72)

## Methods

### \_getPromptType

▸ **_getPromptType**(): ``"prompt"``

Return the string type key uniquely identifying this class of prompt template.

#### Returns

``"prompt"``

#### Overrides

[BasePromptTemplate](.BasePromptTemplate).[_getPromptType](.BasePromptTemplate#_getprompttype)

#### Defined in

[prompt/prompt.ts:87](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/prompt.ts#L87)

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

[prompt/prompt.ts:91](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/prompt.ts#L91)

___

### serialize

▸ **serialize**(): [`SerializedPromptTemplate`](../modules/prompt.md#serializedprompttemplate)

Return a json-like object representing this prompt template.

#### Returns

[`SerializedPromptTemplate`](../modules/prompt.md#serializedprompttemplate)

#### Overrides

[BasePromptTemplate](.BasePromptTemplate).[serialize](.BasePromptTemplate#serialize)

#### Defined in

[prompt/prompt.ts:139](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/prompt.ts#L139)

___

### deserialize

▸ `Static` **deserialize**(`data`): `Promise`<[`PromptTemplate`](.PromptTemplate)\>

Load a prompt template from a json-like object describing it.

**`Remarks`**

Deserializing needs to be async because templates (e.g. [FewShotPromptTemplate](.FewShotPromptTemplate)) can
reference remote resources that we read asynchronously with a web
request.

#### Parameters

| Name | Type |
| :------ | :------ |
| `data` | [`SerializedPromptTemplate`](../modules/prompt.md#serializedprompttemplate) |

#### Returns

`Promise`<[`PromptTemplate`](.PromptTemplate)\>

#### Overrides

[BasePromptTemplate](.BasePromptTemplate).[deserialize](.BasePromptTemplate#deserialize)

#### Defined in

[prompt/prompt.ts:149](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/prompt.ts#L149)

___

### fromExamples

▸ `Static` **fromExamples**(`examples`, `suffix`, `inputVariables`, `exampleSeparator?`, `prefix?`): [`PromptTemplate`](.PromptTemplate)

Take examples in list format with prefix and suffix to create a prompt.

Intendend to be used a a way to dynamically create a prompt from examples.

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `examples` | `string`[] | `undefined` | List of examples to use in the prompt. |
| `suffix` | `string` | `undefined` | String to go after the list of examples. Should generally set up the user's input. |
| `inputVariables` | `string`[] | `undefined` | A list of variable names the final prompt template will expect |
| `exampleSeparator` | `string` | `"\n\n"` | The separator to use in between examples |
| `prefix` | `string` | `""` | String that should go before any examples. Generally includes examples. |

#### Returns

[`PromptTemplate`](.PromptTemplate)

The final prompt template generated.

#### Defined in

[prompt/prompt.ts:108](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/prompt.ts#L108)

___

### fromTemplate

▸ `Static` **fromTemplate**(`template`): [`PromptTemplate`](.PromptTemplate)

Load prompt template from a template f-string

#### Parameters

| Name | Type |
| :------ | :------ |
| `template` | `string` |

#### Returns

[`PromptTemplate`](.PromptTemplate)

#### Defined in

[prompt/prompt.ts:125](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/prompt.ts#L125)
