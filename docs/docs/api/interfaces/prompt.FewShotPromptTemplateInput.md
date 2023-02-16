---
id: "prompt.FewShotPromptTemplateInput"
title: "Interface: FewShotPromptTemplateInput"
sidebar_label: "FewShotPromptTemplateInput"
custom_edit_url: null
---

[prompt](../modules/prompt.md).FewShotPromptTemplateInput

Input common to all prompt templates.

## Hierarchy

- [`BasePromptTemplateInput`](prompt.BasePromptTemplateInput.md)

  ↳ **`FewShotPromptTemplateInput`**

## Implemented by

- [`FewShotPromptTemplate`](../classes/.FewShotPromptTemplate)

## Properties

### examplePrompt

• **examplePrompt**: [`PromptTemplate`](../classes/.PromptTemplate)

An [PromptTemplate](../modules/prompt.md#prompttemplate) used to format a single example.

#### Defined in

[prompt/few_shot.ts:54](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/few_shot.ts#L54)

___

### exampleSelector

• `Optional` **exampleSelector**: ``null``

An ExampleSelector Examples to format into the prompt. Exactly one of this or
[examples](prompt.FewShotPromptTemplateInput.md#examples) must be
provided.

#### Defined in

[prompt/few_shot.ts:49](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/few_shot.ts#L49)

___

### exampleSeparator

• **exampleSeparator**: `string`

String separator used to join the prefix, the examples, and suffix.

#### Defined in

[prompt/few_shot.ts:59](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/few_shot.ts#L59)

___

### examples

• `Optional` **examples**: [`Example`](../modules/prompt.internal.md#example)[]

Examples to format into the prompt. Exactly one of this or
[exampleSelector](prompt.FewShotPromptTemplateInput.md#exampleselector) must be
provided.

#### Defined in

[prompt/few_shot.ts:42](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/few_shot.ts#L42)

___

### inputVariables

• **inputVariables**: `string`[]

A list of variable names the prompt template expects

#### Inherited from

[BasePromptTemplateInput](prompt.BasePromptTemplateInput.md).[inputVariables](prompt.BasePromptTemplateInput.md#inputvariables)

#### Defined in

[prompt/base.ts:20](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/base.ts#L20)

___

### outputParser

• `Optional` **outputParser**: [`BaseOutputParser`](../classes/.internal.BaseOutputParser)

How to parse the output of calling an LLM on this formatted prompt

#### Inherited from

[BasePromptTemplateInput](prompt.BasePromptTemplateInput.md).[outputParser](prompt.BasePromptTemplateInput.md#outputparser)

#### Defined in

[prompt/base.ts:25](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/base.ts#L25)

___

### prefix

• **prefix**: `string`

A prompt template string to put before the examples.

**`Default Value`**

`""`

#### Defined in

[prompt/few_shot.ts:66](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/few_shot.ts#L66)

___

### suffix

• **suffix**: `string`

A prompt template string to put after the examples.

#### Defined in

[prompt/few_shot.ts:71](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/few_shot.ts#L71)

___

### templateFormat

• **templateFormat**: [`TemplateFormat`](../modules/.internal#templateformat)

The format of the prompt template. Options are: 'f-string', 'jinja-2'

#### Defined in

[prompt/few_shot.ts:76](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/few_shot.ts#L76)

___

### validateTemplate

• `Optional` **validateTemplate**: `boolean`

Whether or not to try validating the template on initialization.

#### Defined in

[prompt/few_shot.ts:81](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/few_shot.ts#L81)
