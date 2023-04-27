---
title: "InMemoryCache<T>"
---

# InMemoryCache<T\>

## Type parameters

- `T` = [`Generation`](../../schema/interfaces/Generation.md)[]

## Hierarchy

- [`BaseCache`](../../schema/classes/BaseCache.md)<`T`\>.**InMemoryCache**

## Constructors

### constructor()

> **new InMemoryCache**<T\>(`map`?: `Map`<`string`, `T`\>): [`InMemoryCache`](InMemoryCache.md)<`T`\>

#### Type parameters

- `T` = [`Generation`](../../schema/interfaces/Generation.md)[]

#### Parameters

| Parameter | Type                   |
| :-------- | :--------------------- |
| `map?`    | `Map`<`string`, `T`\> |

#### Returns

[`InMemoryCache`](InMemoryCache.md)<`T`\>

#### Overrides

[BaseCache](../../schema/classes/BaseCache.md).[constructor](../../schema/classes/BaseCache.md#constructor)

#### Defined in

[langchain/src/cache/index.ts:9](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/cache/index.ts#L9)

## Methods

### lookup()

> **lookup**(`prompt`: `string`, `llmKey`: `string`): `Promise`<null \| `T`\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `prompt`  | `string` |
| `llmKey`  | `string` |

#### Returns

`Promise`<null \| `T`\>

#### Overrides

[BaseCache](../../schema/classes/BaseCache.md).[lookup](../../schema/classes/BaseCache.md#lookup)

#### Defined in

[langchain/src/cache/index.ts:14](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/cache/index.ts#L14)

### update()

> **update**(`prompt`: `string`, `llmKey`: `string`, `value`: `T`): `Promise`<`void`\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `prompt`  | `string` |
| `llmKey`  | `string` |
| `value`   | `T`      |

#### Returns

`Promise`<`void`\>

#### Overrides

[BaseCache](../../schema/classes/BaseCache.md).[update](../../schema/classes/BaseCache.md#update)

#### Defined in

[langchain/src/cache/index.ts:18](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/cache/index.ts#L18)

### global()

> `Static` **global**(): [`InMemoryCache`](InMemoryCache.md)<[`Generation`](../../schema/interfaces/Generation.md)[]\>

#### Returns

[`InMemoryCache`](InMemoryCache.md)<[`Generation`](../../schema/interfaces/Generation.md)[]\>

#### Defined in

[langchain/src/cache/index.ts:22](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/cache/index.ts#L22)
