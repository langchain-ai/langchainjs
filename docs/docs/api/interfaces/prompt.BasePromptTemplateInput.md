---
id: "prompt.BasePromptTemplateInput"
title: "Interface: BasePromptTemplateInput"
sidebar_label: "BasePromptTemplateInput"
custom_edit_url: null
---

[prompt](../modules/prompt.md).BasePromptTemplateInput

Input common to all prompt templates.

## Hierarchy

- **`BasePromptTemplateInput`**

  ↳ [`PromptTemplateInput`](prompt.PromptTemplateInput.md)

  ↳ [`FewShotPromptTemplateInput`](prompt.FewShotPromptTemplateInput.md)

## Implemented by

- [`BasePromptTemplate`](../classes/.BasePromptTemplate)

## Properties

### inputVariables

• **inputVariables**: `string`[]

A list of variable names the prompt template expects

#### Defined in

[prompt/base.ts:20](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/base.ts#L20)

___

### outputParser

• `Optional` **outputParser**: [`BaseOutputParser`](../classes/.internal.BaseOutputParser)

How to parse the output of calling an LLM on this formatted prompt

#### Defined in

[prompt/base.ts:25](https://github.com/hwchase17/langchainjs/blob/f0c297a/langchain/prompt/base.ts#L25)
