---
title: "InitializeAgentExecutorOptions"
---

# InitializeAgentExecutorOptions

## Properties

### agentType

> **agentType**: "zero-shot-react-description" \| "chat-zero-shot-react-description" \| "chat-conversational-react-description"

#### Defined in

[langchain/src/agents/initialize.ts:62](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/initialize.ts#L62)
[langchain/src/agents/initialize.ts:67](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/initialize.ts#L67)
[langchain/src/agents/initialize.ts:72](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/initialize.ts#L72)

### agentArgs?

> **agentArgs**: [`ZeroShotCreatePromptArgs`](ZeroShotCreatePromptArgs.md) & [`AgentArgs`](AgentArgs.md) \| [`ChatCreatePromptArgs`](ChatCreatePromptArgs.md) & [`AgentArgs`](AgentArgs.md) \| [`ChatConversationalCreatePromptArgs`](ChatConversationalCreatePromptArgs.md) & [`AgentArgs`](AgentArgs.md)

#### Defined in

[langchain/src/agents/initialize.ts:63](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/initialize.ts#L63)
[langchain/src/agents/initialize.ts:68](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/initialize.ts#L68)
[langchain/src/agents/initialize.ts:73](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/initialize.ts#L73)

### callbackManager?

> **callbackManager**: [`CallbackManager`](../../callbacks/classes/CallbackManager.md)

#### Deprecated

Use `callbacks` instead

#### Defined in

[langchain/src/chains/base.ts:20](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L20)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Defined in

[langchain/src/base_language/index.ts:17](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L17)

### earlyStoppingMethod?

> **earlyStoppingMethod**: [`StoppingMethod`](../types/StoppingMethod.md)

#### Defined in

[langchain/src/agents/executor.ts:19](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/executor.ts#L19)

### maxIterations?

> **maxIterations**: `number`

#### Defined in

[langchain/src/agents/executor.ts:18](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/executor.ts#L18)

### memory?

> **memory**: [`BaseMemory`](../../memory/classes/BaseMemory.md)

#### Defined in

[langchain/src/agents/initialize.ts:64](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/initialize.ts#L64)
[langchain/src/chains/base.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L15)
[langchain/src/agents/initialize.ts:69](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/initialize.ts#L69)
[langchain/src/chains/base.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L15)
[langchain/src/chains/base.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L15)

### returnIntermediateSteps?

> **returnIntermediateSteps**: `boolean`

#### Defined in

[langchain/src/agents/executor.ts:17](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/executor.ts#L17)

### verbose?

> **verbose**: `boolean`

#### Defined in

[langchain/src/base_language/index.ts:16](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L16)
