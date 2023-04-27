---
title: "loadChain()"
---

# loadChain()

Load a chain from [LangchainHub](https://github.com/hwchase17/langchain-hub) or local filesystem.

## Example

Loading from LangchainHub:

```ts
import { loadChain } from "langchain/chains/load";
const chain = await loadChain("lc://chains/hello-world/chain.json");
const res = await chain.call({ topic: "my favorite color" });
```

## Example

Loading from local filesystem:

```ts
import { loadChain } from "langchain/chains/load";
const chain = await loadChain("/path/to/chain.json");
```

> **loadChain**(`uri`: `string`, `values`: `LoadValues` = `{}`): `Promise`<[`BaseChain`](../../chains/classes/BaseChain.md)\>

## Parameters

| Parameter | Type         |
| :-------- | :----------- |
| `uri`     | `string`     |
| `values`  | `LoadValues` |

## Returns

`Promise`<[`BaseChain`](../../chains/classes/BaseChain.md)\>

## Defined in

[langchain/src/chains/load.ts:33](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/load.ts#L33)
