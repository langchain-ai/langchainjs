---
title: "VectorStoreRouterToolkit"
---

# VectorStoreRouterToolkit

## Hierarchy

- [`Toolkit`](Toolkit.md).**VectorStoreRouterToolkit**

## Constructors

### constructor()

> **new VectorStoreRouterToolkit**(`vectorStoreInfos`: [`VectorStoreInfo`](../interfaces/VectorStoreInfo.md)[], `llm`: [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md)): [`VectorStoreRouterToolkit`](VectorStoreRouterToolkit.md)

#### Parameters

| Parameter          | Type                                                                    |
| :----------------- | :---------------------------------------------------------------------- |
| `vectorStoreInfos` | [`VectorStoreInfo`](../interfaces/VectorStoreInfo.md)[]                 |
| `llm`              | [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md) |

#### Returns

[`VectorStoreRouterToolkit`](VectorStoreRouterToolkit.md)

#### Overrides

[Toolkit](Toolkit.md).[constructor](Toolkit.md#constructor)

#### Defined in

[langchain/src/agents/agent_toolkits/vectorstore/vectorstore.ts:46](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent_toolkits/vectorstore/vectorstore.ts#L46)

## Properties

### llm

> **llm**: [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md)

#### Defined in

[langchain/src/agents/agent_toolkits/vectorstore/vectorstore.ts:44](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent_toolkits/vectorstore/vectorstore.ts#L44)

### tools

> **tools**: [`Tool`](../../tools/classes/Tool.md)[]

#### Overrides

[Toolkit](Toolkit.md).[tools](Toolkit.md#tools)

#### Defined in

[langchain/src/agents/agent_toolkits/vectorstore/vectorstore.ts:40](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent_toolkits/vectorstore/vectorstore.ts#L40)

### vectorStoreInfos

> **vectorStoreInfos**: [`VectorStoreInfo`](../interfaces/VectorStoreInfo.md)[]

#### Defined in

[langchain/src/agents/agent_toolkits/vectorstore/vectorstore.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent_toolkits/vectorstore/vectorstore.ts#L42)
