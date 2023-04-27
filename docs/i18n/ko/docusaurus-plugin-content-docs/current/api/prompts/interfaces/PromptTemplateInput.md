---
title: "PromptTemplateInput"
---

# PromptTemplateInput

Inputs to create a [PromptTemplate](../classes/PromptTemplate.md)

## Hierarchy

- [`BasePromptTemplateInput`](BasePromptTemplateInput.md).**PromptTemplateInput**

## Properties

### inputVariables

> **inputVariables**: `string`[]

A list of variable names the prompt template expects

#### Inherited from

[BasePromptTemplateInput](BasePromptTemplateInput.md).[inputVariables](BasePromptTemplateInput.md#inputvariables)

#### Defined in

[langchain/src/prompts/base.ts:34](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L34)

### template

> **template**: `string`

The prompt template

#### Defined in

[langchain/src/prompts/prompt.ts:19](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/prompt.ts#L19)

### outputParser?

> **outputParser**: `BaseOutputParser`<`unknown`\>

How to parse the output of calling an LLM on this formatted prompt

#### Inherited from

[BasePromptTemplateInput](BasePromptTemplateInput.md).[outputParser](BasePromptTemplateInput.md#outputparser)

#### Defined in

[langchain/src/prompts/base.ts:39](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L39)

### partialVariables?

> **partialVariables**: [`PartialValues`](../../schema/types/PartialValues.md)

Partial variables

#### Inherited from

[BasePromptTemplateInput](BasePromptTemplateInput.md).[partialVariables](BasePromptTemplateInput.md#partialvariables)

#### Defined in

[langchain/src/prompts/base.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L42)

### templateFormat?

> **templateFormat**: [`TemplateFormat`](../types/TemplateFormat.md)

The format of the prompt template. Options are 'f-string', 'jinja-2'

#### Default Value

'f-string'

#### Defined in

[langchain/src/prompts/prompt.ts:26](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/prompt.ts#L26)

### validateTemplate?

> **validateTemplate**: `boolean`

Whether or not to try validating the template on initialization

#### Default Value

`true`

#### Defined in

[langchain/src/prompts/prompt.ts:33](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/prompt.ts#L33)
