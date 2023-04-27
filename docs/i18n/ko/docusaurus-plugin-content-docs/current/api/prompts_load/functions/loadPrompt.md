---
title: "loadPrompt()"
---

# loadPrompt()

Load a prompt from [LangchainHub](https://github.com/hwchase17/langchain-hub) or local filesystem.

## Example

Loading from LangchainHub:

```ts
import { loadPrompt } from "langchain/prompts/load";
const prompt = await loadPrompt("lc://prompts/hello-world/prompt.yaml");
```

## Example

Loading from local filesystem:

```ts
import { loadPrompt } from "langchain/prompts/load";
const prompt = await loadPrompt("/path/to/prompt.json");
```

> **loadPrompt**(`uri`: `string`): `Promise`<[`BasePromptTemplate`](../../prompts/classes/BasePromptTemplate.md)\>

## Parameters

| Parameter | Type     |
| :-------- | :------- |
| `uri`     | `string` |

## Returns

`Promise`<[`BasePromptTemplate`](../../prompts/classes/BasePromptTemplate.md)\>

## Defined in

[langchain/src/prompts/load.ts:26](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/prompts/load.ts#L26)
