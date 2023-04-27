---
title: "WriteFileTool"
---

# WriteFileTool

Base class for language models, chains, tools.

## Hierarchy

- [`StructuredTool`](StructuredTool.md).**WriteFileTool**

## Constructors

### constructor()

> **new WriteFileTool**(«destructured»: `WriteFileParams`): [`WriteFileTool`](WriteFileTool.md)

#### Parameters

| Parameter        | Type              |
| :--------------- | :---------------- |
| `«destructured»` | `WriteFileParams` |

#### Returns

[`WriteFileTool`](WriteFileTool.md)

#### Overrides

[StructuredTool](StructuredTool.md).[constructor](StructuredTool.md#constructor)

#### Defined in

[langchain/src/tools/fs.ts:47](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/fs.ts#L47)

## Properties

### description

> **description**: `string` = `"Write file from disk"`

#### Overrides

[StructuredTool](StructuredTool.md).[description](StructuredTool.md#description)

#### Defined in

[langchain/src/tools/fs.ts:43](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/fs.ts#L43)

### name

> **name**: `string` = `"write_file"`

#### Overrides

[StructuredTool](StructuredTool.md).[name](StructuredTool.md#name)

#### Defined in

[langchain/src/tools/fs.ts:41](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/fs.ts#L41)

### returnDirect

> **returnDirect**: `boolean` = `false`

#### Inherited from

[StructuredTool](StructuredTool.md).[returnDirect](StructuredTool.md#returndirect)

#### Defined in

[langchain/src/tools/base.ts:55](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/base.ts#L55)

### schema

> **schema**: `ZodObject`<\{`file_path`: `ZodString`;
> `text`: `ZodString`;}, "strip", `ZodTypeAny`, \{`file_path`: `string`;
> `text`: `string`;}, \{`file_path`: `string`;
> `text`: `string`;}\>

#### Overrides

[StructuredTool](StructuredTool.md).[schema](StructuredTool.md#schema)

#### Defined in

[langchain/src/tools/fs.ts:36](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/fs.ts#L36)

### store

> **store**: [`BaseFileStore`](../../schema/classes/BaseFileStore.md)

#### Defined in

[langchain/src/tools/fs.ts:45](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/fs.ts#L45)

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
| › `text`         | `string` |

#### Returns

`Promise`<`string`\>

#### Overrides

[StructuredTool](StructuredTool.md).[\_call](StructuredTool.md#_call)

#### Defined in

[langchain/src/tools/fs.ts:53](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/fs.ts#L53)

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
