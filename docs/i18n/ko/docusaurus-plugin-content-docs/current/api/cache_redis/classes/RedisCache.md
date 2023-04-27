---
title: "RedisCache"
---

# RedisCache

## Hierarchy

- [`BaseCache`](../../schema/classes/BaseCache.md).**RedisCache**

## Constructors

### constructor()

> **new RedisCache**(`redisClient`: `RedisClientType`<\{}, `Record`<`string`, `never`\>, `Record`<`string`, `never`\>\>): [`RedisCache`](RedisCache.md)

#### Parameters

| Parameter     | Type                                                                                   |
| :------------ | :------------------------------------------------------------------------------------- |
| `redisClient` | `RedisClientType`<\{}, `Record`<`string`, `never`\>, `Record`<`string`, `never`\>\> |

#### Returns

[`RedisCache`](RedisCache.md)

#### Overrides

[BaseCache](../../schema/classes/BaseCache.md).[constructor](../../schema/classes/BaseCache.md#constructor)

#### Defined in

[langchain/src/cache/redis.ts:9](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/cache/redis.ts#L9)

## Methods

### lookup()

> **lookup**(`prompt`: `string`, `llmKey`: `string`): `Promise`<null \| [`Generation`](../../schema/interfaces/Generation.md)[]\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `prompt`  | `string` |
| `llmKey`  | `string` |

#### Returns

`Promise`<null \| [`Generation`](../../schema/interfaces/Generation.md)[]\>

#### Overrides

[BaseCache](../../schema/classes/BaseCache.md).[lookup](../../schema/classes/BaseCache.md#lookup)

#### Defined in

[langchain/src/cache/redis.ts:14](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/cache/redis.ts#L14)

### update()

> **update**(`prompt`: `string`, `llmKey`: `string`, `value`: [`Generation`](../../schema/interfaces/Generation.md)[]): `Promise`<`void`\>

#### Parameters

| Parameter | Type                                                    |
| :-------- | :------------------------------------------------------ |
| `prompt`  | `string`                                                |
| `llmKey`  | `string`                                                |
| `value`   | [`Generation`](../../schema/interfaces/Generation.md)[] |

#### Returns

`Promise`<`void`\>

#### Overrides

[BaseCache](../../schema/classes/BaseCache.md).[update](../../schema/classes/BaseCache.md#update)

#### Defined in

[langchain/src/cache/redis.ts:34](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/cache/redis.ts#L34)
