---
title: "LLMChainInput"
---

# LLMChainInput

## Hierarchy

- [`ChainInputs`](ChainInputs.md).**LLMChainInput**

## Properties

### llm

> **llm**: [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md)

LLM Wrapper to use

#### Defined in

[langchain/src/chains/llm_chain.ts:14](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/llm_chain.ts#L14)

### prompt

> **prompt**: [`BasePromptTemplate`](../../prompts/classes/BasePromptTemplate.md)

Prompt object to use

#### Defined in

[langchain/src/chains/llm_chain.ts:12](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/llm_chain.ts#L12)

### callbackManager?

> **callbackManager**: [`CallbackManager`](../../callbacks/classes/CallbackManager.md)

#### Deprecated

Use `callbacks` instead

#### Inherited from

[ChainInputs](ChainInputs.md).[callbackManager](ChainInputs.md#callbackmanager)

#### Defined in

[langchain/src/chains/base.ts:20](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L20)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Inherited from

[ChainInputs](ChainInputs.md).[callbacks](ChainInputs.md#callbacks)

#### Defined in

[langchain/src/base_language/index.ts:17](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L17)

### memory?

> **memory**: [`BaseMemory`](../../memory/classes/BaseMemory.md)

#### Inherited from

[ChainInputs](ChainInputs.md).[memory](ChainInputs.md#memory)

#### Defined in

[langchain/src/chains/base.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L15)

### outputKey?

> **outputKey**: `string`

Key to use for output, defaults to `text`

#### Defined in

[langchain/src/chains/llm_chain.ts:18](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/llm_chain.ts#L18)

### outputParser?

> **outputParser**: `BaseOutputParser`<`unknown`\>

OutputParser to use

#### Defined in

[langchain/src/chains/llm_chain.ts:16](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/llm_chain.ts#L16)

### verbose?

> **verbose**: `boolean`

#### Inherited from

[ChainInputs](ChainInputs.md).[verbose](ChainInputs.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:16](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L16)
