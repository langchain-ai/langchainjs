---
title: "AutoGPT"
---

# AutoGPT

## Constructors

### constructor()

> **new AutoGPT**(«destructured»: `Omit`<`Required`<[`AutoGPTInput`](../interfaces/AutoGPTInput.md)\>, "aiRole" \| "humanInTheLoop"\> & \{`chain`: [`LLMChain`](../../chains/classes/LLMChain.md);
> `tools`: `ObjectTool`[];
> `feedbackTool`?: [`Tool`](../../tools/classes/Tool.md);}): [`AutoGPT`](AutoGPT.md)

#### Parameters

| Parameter        | Type                                                                                                                                                                                                                                                           |
| :--------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `«destructured»` | `Omit`<`Required`<[`AutoGPTInput`](../interfaces/AutoGPTInput.md)\>, "aiRole" \| "humanInTheLoop"\> & \{`chain`: [`LLMChain`](../../chains/classes/LLMChain.md);<br />`tools`: `ObjectTool`[];<br />`feedbackTool`?: [`Tool`](../../tools/classes/Tool.md);} |

#### Returns

[`AutoGPT`](AutoGPT.md)

#### Defined in

[langchain/src/experimental/autogpt/agent.ts:53](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/autogpt/agent.ts#L53)

## Properties

### aiName

> **aiName**: `string`

#### Defined in

[langchain/src/experimental/autogpt/agent.ts:32](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/autogpt/agent.ts#L32)

### chain

> **chain**: [`LLMChain`](../../chains/classes/LLMChain.md)

#### Defined in

[langchain/src/experimental/autogpt/agent.ts:40](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/autogpt/agent.ts#L40)

### fullMessageHistory

> **fullMessageHistory**: [`BaseChatMessage`](../../schema/classes/BaseChatMessage.md)[]

#### Defined in

[langchain/src/experimental/autogpt/agent.ts:36](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/autogpt/agent.ts#L36)

### maxIterations

> **maxIterations**: `number`

#### Defined in

[langchain/src/experimental/autogpt/agent.ts:48](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/autogpt/agent.ts#L48)

### memory

> **memory**: [`VectorStoreRetriever`](../../vectorstores_base/classes/VectorStoreRetriever.md)<[`VectorStore`](../../vectorstores_base/classes/VectorStore.md)\>

#### Defined in

[langchain/src/experimental/autogpt/agent.ts:34](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/autogpt/agent.ts#L34)

### nextActionCount

> **nextActionCount**: `number`

#### Defined in

[langchain/src/experimental/autogpt/agent.ts:38](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/autogpt/agent.ts#L38)

### outputParser

> **outputParser**: [`AutoGPTOutputParser`](AutoGPTOutputParser.md)

#### Defined in

[langchain/src/experimental/autogpt/agent.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/autogpt/agent.ts#L42)

### textSplitter

> **textSplitter**: [`TokenTextSplitter`](../../text_splitter/classes/TokenTextSplitter.md)

#### Defined in

[langchain/src/experimental/autogpt/agent.ts:51](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/autogpt/agent.ts#L51)

### tools

> **tools**: `ObjectTool`[]

#### Defined in

[langchain/src/experimental/autogpt/agent.ts:44](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/autogpt/agent.ts#L44)

### feedbackTool?

> **feedbackTool**: [`Tool`](../../tools/classes/Tool.md)

#### Defined in

[langchain/src/experimental/autogpt/agent.ts:46](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/autogpt/agent.ts#L46)

## Methods

### run()

> **run**(`goals`: `string`[]): `Promise`<`undefined` \| `string`\>

#### Parameters

| Parameter | Type       |
| :-------- | :--------- |
| `goals`   | `string`[] |

#### Returns

`Promise`<`undefined` \| `string`\>

#### Defined in

[langchain/src/experimental/autogpt/agent.ts:120](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/autogpt/agent.ts#L120)

### fromLLMAndTools()

> `Static` **fromLLMAndTools**(`llm`: [`BaseChatModel`](../../chat_models_base/classes/BaseChatModel.md), `tools`: `ObjectTool`[], «destructured»: [`AutoGPTInput`](../interfaces/AutoGPTInput.md)): [`AutoGPT`](AutoGPT.md)

#### Parameters

| Parameter        | Type                                                               |
| :--------------- | :----------------------------------------------------------------- |
| `llm`            | [`BaseChatModel`](../../chat_models_base/classes/BaseChatModel.md) |
| `tools`          | `ObjectTool`[]                                                     |
| `«destructured»` | [`AutoGPTInput`](../interfaces/AutoGPTInput.md)                    |

#### Returns

[`AutoGPT`](AutoGPT.md)

#### Defined in

[langchain/src/experimental/autogpt/agent.ts:86](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/autogpt/agent.ts#L86)
