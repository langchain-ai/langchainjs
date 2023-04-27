---
title: "BasePromptTemplateInput"
---

# BasePromptTemplateInput

Input common to all prompt templates.

## Hierarchy

- [`PromptTemplateInput`](PromptTemplateInput.md)
- [`FewShotPromptTemplateInput`](FewShotPromptTemplateInput.md)

## Properties

### inputVariables

> **inputVariables**: `string`[]

A list of variable names the prompt template expects

#### Defined in

[langchain/src/prompts/base.ts:34](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L34)

### outputParser?

> **outputParser**: `BaseOutputParser`<`unknown`\>

How to parse the output of calling an LLM on this formatted prompt

#### Defined in

[langchain/src/prompts/base.ts:39](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L39)

### partialVariables?

> **partialVariables**: [`PartialValues`](../../schema/types/PartialValues.md)

Partial variables

#### Defined in

[langchain/src/prompts/base.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/base.ts#L42)
