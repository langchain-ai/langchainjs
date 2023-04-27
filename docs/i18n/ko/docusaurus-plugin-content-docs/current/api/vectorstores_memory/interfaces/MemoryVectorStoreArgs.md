---
title: "MemoryVectorStoreArgs"
---

# MemoryVectorStoreArgs

## Properties

### similarity?

> **similarity**: `Function`

#### Type declaration

Returns the average of cosine distances between vectors a and b

> (`a`: `NumberArray`, `b`: `NumberArray`): `number`

##### Parameters

| Parameter | Type          | Description   |
| :-------- | :------------ | :------------ |
| `a`       | `NumberArray` | first vector  |
| `b`       | `NumberArray` | second vector |

##### Returns

`number`

#### Defined in

[langchain/src/vectorstores/memory.ts:14](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/memory.ts#L14)
