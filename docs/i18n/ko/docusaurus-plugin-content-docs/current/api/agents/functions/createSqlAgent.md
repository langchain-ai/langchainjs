---
title: "createSqlAgent()"
---

# createSqlAgent()

> **createSqlAgent**(`llm`: [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md), `toolkit`: [`SqlToolkit`](../classes/SqlToolkit.md), `args`?: [`SqlCreatePromptArgs`](../interfaces/SqlCreatePromptArgs.md)): [`AgentExecutor`](../classes/AgentExecutor.md)

## Parameters

| Parameter | Type                                                                    |
| :-------- | :---------------------------------------------------------------------- |
| `llm`     | [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md) |
| `toolkit` | [`SqlToolkit`](../classes/SqlToolkit.md)                                |
| `args?`   | [`SqlCreatePromptArgs`](../interfaces/SqlCreatePromptArgs.md)           |

## Returns

[`AgentExecutor`](../classes/AgentExecutor.md)

## Defined in

[langchain/src/agents/agent_toolkits/sql/sql.ts:41](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent_toolkits/sql/sql.ts#L41)
