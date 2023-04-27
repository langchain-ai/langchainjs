---
title: "FewShotPromptTemplateInput"
---

# FewShotPromptTemplateInput

Input common to all prompt templates.

## Hierarchy

- [`BasePromptTemplateInput`](BasePromptTemplateInput.md).**FewShotPromptTemplateInput**

## Properties

### examplePrompt

> **examplePrompt**: [`PromptTemplate`](../classes/PromptTemplate.md)

An [PromptTemplate](../classes/PromptTemplate.md) used to format a single example.

#### Defined in

[langchain/src/prompts/few_shot.ts:33](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/few_shot.ts#L33)

### inputVariables

> **inputVariables**: `string`[]

A list of variable names the prompt template expects

#### Inherited from

[BasePromptTemplateInput](BasePromptTemplateInput.md).[inputVariables](BasePromptTemplateInput.md#inputvariables)

#### Defined in

[langchain/src/prompts/base.ts:34](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L34)

### exampleSelector?

> **exampleSelector**: [`BaseExampleSelector`](../classes/BaseExampleSelector.md)

An [BaseExampleSelector](../classes/BaseExampleSelector.md) Examples to format into the prompt. Exactly one of this or
[examples](FewShotPromptTemplateInput.md#examples) must be
provided.

#### Defined in

[langchain/src/prompts/few_shot.ts:28](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/few_shot.ts#L28)

### exampleSeparator?

> **exampleSeparator**: `string`

String separator used to join the prefix, the examples, and suffix.

#### Defined in

[langchain/src/prompts/few_shot.ts:38](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/few_shot.ts#L38)

### examples?

> **examples**: [`Example`](../../schema/types/Example.md)[]

Examples to format into the prompt. Exactly one of this or
[exampleSelector](FewShotPromptTemplateInput.md#exampleselector) must be
provided.

#### Defined in

[langchain/src/prompts/few_shot.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/few_shot.ts#L21)

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

### prefix?

> **prefix**: `string`

A prompt template string to put before the examples.

#### Default Value

`""`

#### Defined in

[langchain/src/prompts/few_shot.ts:45](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/few_shot.ts#L45)

### suffix?

> **suffix**: `string`

A prompt template string to put after the examples.

#### Defined in

[langchain/src/prompts/few_shot.ts:50](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/few_shot.ts#L50)

### templateFormat?

> **templateFormat**: [`TemplateFormat`](../types/TemplateFormat.md)

The format of the prompt template. Options are: 'f-string', 'jinja-2'

#### Defined in

[langchain/src/prompts/few_shot.ts:55](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/few_shot.ts#L55)

### validateTemplate?

> **validateTemplate**: `boolean`

Whether or not to try validating the template on initialization.

#### Defined in

[langchain/src/prompts/few_shot.ts:60](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/few_shot.ts#L60)
