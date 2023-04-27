---
title: "BingSerpAPI"
---

# BingSerpAPI

Base class for language models, chains, tools.

## Hierarchy

- [`Tool`](Tool.md).**BingSerpAPI**

## Constructors

### constructor()

> **new BingSerpAPI**(`apiKey`: `undefined` \| `string` = `...`, `params`: `Record`<`string`, `string`\> = `{}`): [`BingSerpAPI`](BingSerpAPI.md)

#### Parameters

| Parameter | Type                           |
| :-------- | :----------------------------- |
| `apiKey`  | `undefined` \| `string`        |
| `params`  | `Record`<`string`, `string`\> |

#### Returns

[`BingSerpAPI`](BingSerpAPI.md)

#### Overrides

[Tool](Tool.md).[constructor](Tool.md#constructor)

#### Defined in

[langchain/src/tools/bingserpapi.ts:13](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/bingserpapi.ts#L13)

## Properties

### description

> **description**: `string` = `"a search engine. useful for when you need to answer questions about current events. input should be a search query."`

#### Overrides

[Tool](Tool.md).[description](Tool.md#description)

#### Defined in

[langchain/src/tools/bingserpapi.ts:6](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/bingserpapi.ts#L6)

### key

> **key**: `string`

#### Defined in

[langchain/src/tools/bingserpapi.ts:9](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/bingserpapi.ts#L9)

### name

> **name**: `string` = `"bing-search"`

#### Overrides

[Tool](Tool.md).[name](Tool.md#name)

#### Defined in

[langchain/src/tools/bingserpapi.ts:4](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/bingserpapi.ts#L4)

### params

> **params**: `Record`<`string`, `string`\>

#### Defined in

[langchain/src/tools/bingserpapi.ts:11](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/bingserpapi.ts#L11)

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
