---
title: "QueryCheckerTool"
---

# QueryCheckerTool

Base class for language models, chains, tools.

## Hierarchy

- [`Tool`](Tool.md).**QueryCheckerTool**

## Constructors

### constructor()

> **new QueryCheckerTool**(`llmChain`?: [`LLMChain`](../../chains/classes/LLMChain.md)): [`QueryCheckerTool`](QueryCheckerTool.md)

#### Parameters

| Parameter   | Type                                           |
| :---------- | :--------------------------------------------- |
| `llmChain?` | [`LLMChain`](../../chains/classes/LLMChain.md) |

#### Returns

[`QueryCheckerTool`](QueryCheckerTool.md)

#### Overrides

[Tool](Tool.md).[constructor](Tool.md#constructor)

#### Defined in

[langchain/src/tools/sql.ts:106](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/sql.ts#L106)

## Properties

### description

> **description**: `string`

#### Overrides

[Tool](Tool.md).[description](Tool.md#description)

#### Defined in

[langchain/src/tools/sql.ts:125](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/sql.ts#L125)

### llmChain

> **llmChain**: [`LLMChain`](../../chains/classes/LLMChain.md)

#### Defined in

[langchain/src/tools/sql.ts:104](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/sql.ts#L104)

### name

> **name**: `string` = `"query-checker"`

#### Overrides

[Tool](Tool.md).[name](Tool.md#name)

#### Defined in

[langchain/src/tools/sql.ts:88](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/sql.ts#L88)

### returnDirect

> **returnDirect**: `boolean` = `false`

#### Inherited from

[Tool](Tool.md).[returnDirect](Tool.md#returndirect)

#### Defined in

[langchain/src/tools/base.ts:55](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/base.ts#L55)

### schema

> **schema**: `ZodEffects`<`ZodObject`<\{`input`: `ZodOptional`<`ZodString`\>;}, "strip", `ZodTypeAny`, \{`input`?: `string`;}, \{`input`?: `string`;}\>, `undefined` \| `string`, \{`input`?: `string`;}\>

#### Inherited from

[Tool](Tool.md).[schema](Tool.md#schema)

#### Defined in

[langchain/src/tools/base.ts:59](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/base.ts#L59)

### template

> **template**: `string`

#### Defined in

[langchain/src/tools/sql.ts:90](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/sql.ts#L90)

### verbose

> **verbose**: `boolean`

Whether to print out response text.

#### Inherited from

[Tool](Tool.md).[verbose](Tool.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L27)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Inherited from

[Tool](Tool.md).[callbacks](Tool.md#callbacks)

#### Defined in

[langchain/src/base_language/index.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L29)

## Methods

### call()

> **call**(`arg`: `undefined` \| `string` \| \{`input`?: `string`;}, `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<`string`\>

#### Parameters

| Parameter    | Type                                              |
| :----------- | :------------------------------------------------ |
| `arg`        | `undefined` \| `string` \| \{`input`?: `string`;} |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md) |

#### Returns

`Promise`<`string`\>

#### Inherited from

[Tool](Tool.md).[call](Tool.md#call)

#### Defined in

[langchain/src/tools/base.ts:67](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/base.ts#L67)
