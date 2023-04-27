---
title: "BaseCache<T>"
---

# BaseCache<T\>

## Type parameters

- `T` = [`Generation`](../interfaces/Generation.md)[]

## Hierarchy

- [`InMemoryCache`](../../cache/classes/InMemoryCache.md)
- [`RedisCache`](../../cache_redis/classes/RedisCache.md)

## Constructors

### constructor()

> **new BaseCache**<T\>(): [`BaseCache`](BaseCache.md)<`T`\>

#### Type parameters

- `T` = [`Generation`](../interfaces/Generation.md)[]

#### Returns

[`BaseCache`](BaseCache.md)<`T`\>

## Methods

### lookup()

> `Abstract` **lookup**(`prompt`: `string`, `llmKey`: `string`): `Promise`<null \| `T`\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `prompt`  | `string` |
| `llmKey`  | `string` |

#### Returns

`Promise`<null \| `T`\>

#### Defined in

[langchain/src/schema/index.ts:155](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/index.ts#L155)

### update()

> `Abstract` **update**(`prompt`: `string`, `llmKey`: `string`, `value`: `T`): `Promise`<`void`\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `prompt`  | `string` |
| `llmKey`  | `string` |
| `value`   | `T`      |

#### Returns

`Promise`<`void`\>

#### Defined in

[langchain/src/schema/index.ts:157](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/schema/index.ts#L157)
