---
id: "agents.internal"
title: "Module: internal"
sidebar_label: "internal"
custom_edit_url: null
---

## Type Aliases

### AgentExecutorInput

Ƭ **AgentExecutorInput**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `agent` | [`Agent`](../classes/agents.Agent.md) |
| `earlyStoppingMethod?` | [`StoppingMethod`](agents.md#stoppingmethod) |
| `maxIterations?` | `number` |
| `returnIntermediateSteps?` | `boolean` |
| `tools` | [`Tool`](../classes/agents.Tool.md)[] |

#### Defined in

[agents/executor.ts:5](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/agents/executor.ts#L5)

___

### CreatePromptArgs

Ƭ **CreatePromptArgs**: `Object`

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `inputVariables?` | `string`[] | List of input variables the final prompt will expect. |
| `prefix?` | `string` | String to put before the list of tools. |
| `suffix?` | `string` | String to put after the list of tools. |

#### Defined in

[agents/mrkl/index.ts:29](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/agents/mrkl/index.ts#L29)

___

### SerializedBaseChain

Ƭ **SerializedBaseChain**: `ReturnType`<`InstanceType`<typeof [`chainClasses`](agents.internal.md#chainclasses)[`number`]\>[``"serialize"``]\>

#### Defined in

[chains/base.ts:7](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/chains/base.ts#L7)

___

### SerializedFromLLMAndTools

Ƭ **SerializedFromLLMAndTools**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `input_variables?` | `string`[] |
| `prefix?` | `string` |
| `suffix?` | `string` |

#### Defined in

[agents/mrkl/index.ts:17](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/agents/mrkl/index.ts#L17)

## Variables

### chainClasses

• `Const` **chainClasses**: (typeof [`LLMChain`](../classes/.LLMChain) \| typeof [`StuffDocumentsChain`](../classes/chains.StuffDocumentsChain.md))[]

#### Defined in

[chains/base.ts:5](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/chains/base.ts#L5)
