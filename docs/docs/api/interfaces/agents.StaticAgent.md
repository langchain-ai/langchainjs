---
id: "agents.StaticAgent"
title: "Interface: StaticAgent"
sidebar_label: "StaticAgent"
custom_edit_url: null
---

[agents](../modules/agents.md).StaticAgent

## Methods

### createPrompt

▸ **createPrompt**(`tools`, `fields?`): [`BasePromptTemplate`](../classes/.BasePromptTemplate)

Create a prompt for this class

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `tools` | [`Tool`](../classes/agents.Tool.md)[] | List of tools the agent will have access to, used to format the prompt. |
| `fields?` | `Record`<`string`, `any`\> | Additional fields used to format the prompt. |

#### Returns

[`BasePromptTemplate`](../classes/.BasePromptTemplate)

A PromptTemplate assembled from the given tools and fields.

#### Defined in

[agents/agent.ts:36](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/agents/agent.ts#L36)

___

### fromLLMAndTools

▸ **fromLLMAndTools**(`llm`, `tools`, `args?`): [`Agent`](../classes/agents.Agent.md)

Construct an agent from an LLM and a list of tools

#### Parameters

| Name | Type |
| :------ | :------ |
| `llm` | [`BaseLLM`](../classes/llms.BaseLLM.md) |
| `tools` | [`Tool`](../classes/agents.Tool.md)[] |
| `args?` | `Record`<`string`, `any`\> |

#### Returns

[`Agent`](../classes/agents.Agent.md)

#### Defined in

[agents/agent.ts:38](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/agents/agent.ts#L38)

___

### validateTools

▸ **validateTools**(`_`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `_` | [`Tool`](../classes/agents.Tool.md)[] |

#### Returns

`void`

#### Defined in

[agents/agent.ts:44](https://github.com/hwchase17/langchainjs/blob/46f8b74/langchain/agents/agent.ts#L44)
