---
title: "StructuredTool<T>"
---

# StructuredTool<T\>

Base class for language models, chains, tools.

## Type parameters

- `T` _extends_ `z.ZodObject`<`any`, `any`, `any`, `any`\> = `z.ZodObject`<`any`, `any`, `any`, `any`\>

## Hierarchy

- [`BaseLangChain`](../../base_language/classes/BaseLangChain.md).**StructuredTool**

## Constructors

### constructor()

> **new StructuredTool**<T\>(`fields`?: [`ToolParams`](../interfaces/ToolParams.md)): [`StructuredTool`](StructuredTool.md)<`T`\>

#### Type parameters

- `T` _extends_ `ZodObject`<`any`, `any`, `any`, `any`, \{}, `T`\> = `ZodObject`<`any`, `any`, `any`, `any`, \{}\>

#### Parameters

| Parameter | Type                                        |
| :-------- | :------------------------------------------ |
| `fields?` | [`ToolParams`](../interfaces/ToolParams.md) |

#### Returns

[`StructuredTool`](StructuredTool.md)<`T`\>

#### Overrides

[BaseLangChain](../../base_language/classes/BaseLangChain.md).[constructor](../../base_language/classes/BaseLangChain.md#constructor)

#### Defined in

[langchain/src/tools/base.ts:17](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/base.ts#L17)

## Properties

### description

> `Abstract` **description**: `string`

#### Defined in

[langchain/src/tools/base.ts:53](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/base.ts#L53)

### name

> `Abstract` **name**: `string`

#### Defined in

[langchain/src/tools/base.ts:51](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/base.ts#L51)

### returnDirect

> **returnDirect**: `boolean` = `false`

#### Defined in

[langchain/src/tools/base.ts:55](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/base.ts#L55)

### schema

> `Abstract` **schema**: `T` \| `ZodEffects`<`T`, `output`<`T`\>, `input`<`T`\>\>

#### Defined in

[langchain/src/tools/base.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/base.ts#L15)

### verbose

> **verbose**: `boolean`

Whether to print out response text.

#### Inherited from

[BaseLangChain](../../base_language/classes/BaseLangChain.md).[verbose](../../base_language/classes/BaseLangChain.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L27)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Inherited from

[BaseLangChain](../../base_language/classes/BaseLangChain.md).[callbacks](../../base_language/classes/BaseLangChain.md#callbacks)

#### Defined in

[langchain/src/base_language/index.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L29)

## Methods

### call()

> **call**(`arg`: `input`<`T`\> \| `output`<`T`\> _extends_ `string` ? `string` : `never`, `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<`string`\>

#### Parameters

| Parameter    | Type                                                                      |
| :----------- | :------------------------------------------------------------------------ |
| `arg`        | `input`<`T`\> \| `output`<`T`\> _extends_ `string` ? `string` : `never` |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md)                         |

#### Returns

`Promise`<`string`\>

#### Defined in

[langchain/src/tools/base.ts:26](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/base.ts#L26)

### \_call()

> `Protected` `Abstract` **\_call**(`arg`: `output`<`T`\>, `runManager`?: [`CallbackManagerForToolRun`](../../callbacks/classes/CallbackManagerForToolRun.md)): `Promise`<`string`\>

#### Parameters

| Parameter     | Type                                                                                |
| :------------ | :---------------------------------------------------------------------------------- |
| `arg`         | `output`<`T`\>                                                                     |
| `runManager?` | [`CallbackManagerForToolRun`](../../callbacks/classes/CallbackManagerForToolRun.md) |

#### Returns

`Promise`<`string`\>

#### Defined in

[langchain/src/tools/base.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/base.ts#L21)
