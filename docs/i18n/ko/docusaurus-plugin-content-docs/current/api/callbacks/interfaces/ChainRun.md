---
title: "ChainRun"
---

# ChainRun

## Hierarchy

- [`BaseRun`](BaseRun.md).**ChainRun**

## Properties

### child_chain_runs

> **child_chain_runs**: [`ChainRun`](ChainRun.md)[]

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:38](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L38)

### child_llm_runs

> **child_llm_runs**: [`LLMRun`](LLMRun.md)[]

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:37](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L37)

### child_tool_runs

> **child_tool_runs**: [`ToolRun`](ToolRun.md)[]

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:39](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L39)

### end_time

> **end_time**: `number`

#### Inherited from

[BaseRun](BaseRun.md).[end_time](BaseRun.md#end_time)

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L21)

### execution_order

> **execution_order**: `number`

#### Inherited from

[BaseRun](BaseRun.md).[execution_order](BaseRun.md#execution_order)

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:22](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L22)

### inputs

> **inputs**: [`ChainValues`](../../schema/types/ChainValues.md)

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:35](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L35)

### serialized

> **serialized**: `object`

#### Type declaration

| Member | Type     |
| :----- | :------- |
| `name` | `string` |

#### Inherited from

[BaseRun](BaseRun.md).[serialized](BaseRun.md#serialized)

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:23](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L23)

### session_id

> **session_id**: `number`

#### Inherited from

[BaseRun](BaseRun.md).[session_id](BaseRun.md#session_id)

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:24](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L24)

### start_time

> **start_time**: `number`

#### Inherited from

[BaseRun](BaseRun.md).[start_time](BaseRun.md#start_time)

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:20](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L20)

### type

> **type**: `RunType`

#### Inherited from

[BaseRun](BaseRun.md).[type](BaseRun.md#type)

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:26](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L26)

### uuid

> **uuid**: `string`

#### Inherited from

[BaseRun](BaseRun.md).[uuid](BaseRun.md#uuid)

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:18](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L18)

### error?

> **error**: `string`

#### Inherited from

[BaseRun](BaseRun.md).[error](BaseRun.md#error)

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:25](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L25)

### outputs?

> **outputs**: [`ChainValues`](../../schema/types/ChainValues.md)

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:36](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L36)

### parent_uuid?

> **parent_uuid**: `string`

#### Inherited from

[BaseRun](BaseRun.md).[parent_uuid](BaseRun.md#parent_uuid)

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:19](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L19)
