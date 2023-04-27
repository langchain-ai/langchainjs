---
title: "OpenApiToolkit"
---

# OpenApiToolkit

## Hierarchy

- [`RequestsToolkit`](RequestsToolkit.md).**OpenApiToolkit**

## Constructors

### constructor()

> **new OpenApiToolkit**(`jsonSpec`: [`JsonSpec`](../../tools/classes/JsonSpec.md), `llm`: [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md), `headers`?: `Headers`): [`OpenApiToolkit`](OpenApiToolkit.md)

#### Parameters

| Parameter  | Type                                                                    |
| :--------- | :---------------------------------------------------------------------- |
| `jsonSpec` | [`JsonSpec`](../../tools/classes/JsonSpec.md)                           |
| `llm`      | [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md) |
| `headers?` | `Headers`                                                               |

#### Returns

[`OpenApiToolkit`](OpenApiToolkit.md)

#### Overrides

[RequestsToolkit](RequestsToolkit.md).[constructor](RequestsToolkit.md#constructor)

#### Defined in

[langchain/src/agents/agent_toolkits/openapi/openapi.ts:31](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent_toolkits/openapi/openapi.ts#L31)

## Properties

### tools

> **tools**: [`Tool`](../../tools/classes/Tool.md)[]

#### Inherited from

[RequestsToolkit](RequestsToolkit.md).[tools](RequestsToolkit.md#tools)

#### Defined in

[langchain/src/agents/agent_toolkits/openapi/openapi.ts:22](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/agents/agent_toolkits/openapi/openapi.ts#L22)
