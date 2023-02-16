---
id: "prompt.PromptTemplateInput"
title: "Interface: PromptTemplateInput"
sidebar_label: "PromptTemplateInput"
custom_edit_url: null
---

[prompt](../modules/prompt.md).PromptTemplateInput

Inputs to create a [PromptTemplate](../modules/prompt.md#prompttemplate)

## Hierarchy

- [`BasePromptTemplateInput`](prompt.BasePromptTemplateInput.md)

  ↳ **`PromptTemplateInput`**

## Implemented by

- [`PromptTemplate`](../classes/.PromptTemplate)

## Properties

### inputVariables

• **inputVariables**: `string`[]

A list of variable names the prompt template expects

#### Inherited from

[BasePromptTemplateInput](prompt.BasePromptTemplateInput.md).[inputVariables](prompt.BasePromptTemplateInput.md#inputvariables)

#### Defined in

[prompt/base.ts:20](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/prompt/base.ts#L20)

___

### outputParser

• `Optional` **outputParser**: [`BaseOutputParser`](../classes/.internal.BaseOutputParser)

How to parse the output of calling an LLM on this formatted prompt

#### Inherited from

[BasePromptTemplateInput](prompt.BasePromptTemplateInput.md).[outputParser](prompt.BasePromptTemplateInput.md#outputparser)

#### Defined in

[prompt/base.ts:25](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/prompt/base.ts#L25)

___

### template

• **template**: `string`

The propmt template

#### Defined in

[prompt/prompt.ts:32](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/prompt/prompt.ts#L32)

___

### templateFormat

• `Optional` **templateFormat**: [`TemplateFormat`](../modules/.internal#templateformat)

The format of the prompt template. Options are 'f-string', 'jinja-2'

**`Default Value`**

'f-string'

#### Defined in

[prompt/prompt.ts:39](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/prompt/prompt.ts#L39)

___

### validateTemplate

• `Optional` **validateTemplate**: `boolean`

Whether or not to try validating the template on initialization

**`Default Value`**

`true`

#### Defined in

[prompt/prompt.ts:46](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/prompt/prompt.ts#L46)
