---
title: "Serper"
---

# Serper

Wrapper around serper.

You can create a free API key at https://serper.dev.

To use, you should have the SERPER_API_KEY environment variable set.

## Hierarchy

- [`Tool`](Tool.md).**Serper**

## Constructors

### constructor()

> **new Serper**(`apiKey`: `undefined` \| `string` = `...`, `params`: `Partial`<[`SerperParameters`](../types/SerperParameters.md)\> = `{}`): [`Serper`](Serper.md)

#### Parameters

| Parameter | Type                                                            |
| :-------- | :-------------------------------------------------------------- |
| `apiKey`  | `undefined` \| `string`                                         |
| `params`  | `Partial`<[`SerperParameters`](../types/SerperParameters.md)\> |

#### Returns

[`Serper`](Serper.md)

#### Overrides

[Tool](Tool.md).[constructor](Tool.md#constructor)

#### Defined in

[langchain/src/tools/serper.ts:20](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serper.ts#L20)

## Properties

### description

> **description**: `string` = `"a search engine. useful for when you need to answer questions about current events. input should be a search query."`

#### Overrides

[Tool](Tool.md).[description](Tool.md#description)

#### Defined in

[langchain/src/tools/serper.ts:90](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serper.ts#L90)

### name

> **name**: `string` = `"search"`

#### Overrides

[Tool](Tool.md).[name](Tool.md#name)

#### Defined in

[langchain/src/tools/serper.ts:39](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serper.ts#L39)

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

### key

> `Protected` **key**: `string`

#### Defined in

[langchain/src/tools/serper.ts:16](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serper.ts#L16)

### params

> `Protected` **params**: `Partial`<[`SerperParameters`](../types/SerperParameters.md)\>

#### Defined in

[langchain/src/tools/serper.ts:18](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/tools/serper.ts#L18)

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
