---
title: "ReadFileTool"
---

# ReadFileTool

Base class for language models, chains, tools.

## Hierarchy

- [`StructuredTool`](StructuredTool.md).**ReadFileTool**

## Constructors

### constructor()

> **new ReadFileTool**(«destructured»: `ReadFileParams`): [`ReadFileTool`](ReadFileTool.md)

#### Parameters

| Parameter        | Type             |
| :--------------- | :--------------- |
| `«destructured»` | `ReadFileParams` |

#### Returns

[`ReadFileTool`](ReadFileTool.md)

#### Overrides

[StructuredTool](StructuredTool.md).[constructor](StructuredTool.md#constructor)

#### Defined in

[langchain/src/tools/fs.ts:20](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/fs.ts#L20)

## Properties

### description

> **description**: `string` = `"Read file from disk"`

#### Overrides

[StructuredTool](StructuredTool.md).[description](StructuredTool.md#description)

#### Defined in

[langchain/src/tools/fs.ts:16](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/fs.ts#L16)

### name

> **name**: `string` = `"read_file"`

#### Overrides

[StructuredTool](StructuredTool.md).[name](StructuredTool.md#name)

#### Defined in

[langchain/src/tools/fs.ts:14](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/fs.ts#L14)

### returnDirect

> **returnDirect**: `boolean` = `false`

#### Inherited from

[StructuredTool](StructuredTool.md).[returnDirect](StructuredTool.md#returndirect)

#### Defined in

[langchain/src/tools/base.ts:55](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/base.ts#L55)

### schema

> **schema**: `ZodObject`<\{`file_path`: `ZodString`;}, "strip", `ZodTypeAny`, \{`file_path`: `string`;}, \{`file_path`: `string`;}\>

#### Overrides

[StructuredTool](StructuredTool.md).[schema](StructuredTool.md#schema)

#### Defined in

[langchain/src/tools/fs.ts:10](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/fs.ts#L10)

### store

> **store**: [`BaseFileStore`](../../schema/classes/BaseFileStore.md)

#### Defined in

[langchain/src/tools/fs.ts:18](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/fs.ts#L18)

### verbose

> **verbose**: `boolean`

Whether to print out response text.

#### Inherited from

[StructuredTool](StructuredTool.md).[verbose](StructuredTool.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L27)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Inherited from

[StructuredTool](StructuredTool.md).[callbacks](StructuredTool.md#callbacks)

#### Defined in

[langchain/src/base_language/index.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L29)

## Methods

### \_call()

> **\_call**(«destructured»: `object`): `Promise`<`string`\>

#### Parameters

| Parameter        | Type     |
| :--------------- | :------- |
| `«destructured»` | `object` |
| › `file_path`    | `string` |

#### Returns

`Promise`<`string`\>

#### Overrides

[StructuredTool](StructuredTool.md).[\_call](StructuredTool.md#_call)

#### Defined in

[langchain/src/tools/fs.ts:26](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/fs.ts#L26)

### call()

> **call**(`arg`: `string` \| \{}, `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<`string`\>

#### Parameters

| Parameter    | Type                                              |
| :----------- | :------------------------------------------------ |
| `arg`        | `string` \| \{}                                   |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md) |

#### Returns

`Promise`<`string`\>

#### Inherited from

[StructuredTool](StructuredTool.md).[call](StructuredTool.md#call)

#### Defined in

[langchain/src/tools/base.ts:26](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/base.ts#L26)
