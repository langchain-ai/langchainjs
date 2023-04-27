---
title: "VectorStoreToolkit"
---

# VectorStoreToolkit

## Hierarchy

- [`Toolkit`](Toolkit.md).**VectorStoreToolkit**

## Constructors

### constructor()

> **new VectorStoreToolkit**(`vectorStoreInfo`: [`VectorStoreInfo`](../interfaces/VectorStoreInfo.md), `llm`: [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md)): [`VectorStoreToolkit`](VectorStoreToolkit.md)

#### Parameters

| Parameter         | Type                                                                    |
| :---------------- | :---------------------------------------------------------------------- |
| `vectorStoreInfo` | [`VectorStoreInfo`](../interfaces/VectorStoreInfo.md)                   |
| `llm`             | [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md) |

#### Returns

[`VectorStoreToolkit`](VectorStoreToolkit.md)

#### Overrides

[Toolkit](Toolkit.md).[constructor](Toolkit.md#constructor)

#### Defined in

[langchain/src/agents/agent_toolkits/vectorstore/vectorstore.ts:23](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent_toolkits/vectorstore/vectorstore.ts#L23)

## Properties

### llm

> **llm**: [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md)

#### Defined in

[langchain/src/agents/agent_toolkits/vectorstore/vectorstore.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent_toolkits/vectorstore/vectorstore.ts#L21)

### tools

> **tools**: [`Tool`](../../tools/classes/Tool.md)[]

#### Overrides

[Toolkit](Toolkit.md).[tools](Toolkit.md#tools)

#### Defined in

[langchain/src/agents/agent_toolkits/vectorstore/vectorstore.ts:19](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent_toolkits/vectorstore/vectorstore.ts#L19)
