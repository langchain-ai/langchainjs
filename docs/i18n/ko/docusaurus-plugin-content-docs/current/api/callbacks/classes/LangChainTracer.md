---
title: "LangChainTracer"
---

# LangChainTracer

## Hierarchy

- `BaseTracer`.**LangChainTracer**

## Constructors

### constructor()

> **new LangChainTracer**(): [`LangChainTracer`](LangChainTracer.md)

#### Returns

[`LangChainTracer`](LangChainTracer.md)

#### Overrides

BaseTracer.constructor

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:284](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L284)

## Properties

### ignoreAgent

> **ignoreAgent**: `boolean` = `false`

#### Inherited from

BaseTracer.ignoreAgent

#### Defined in

[langchain/src/callbacks/base.ts:163](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L163)

### ignoreChain

> **ignoreChain**: `boolean` = `false`

#### Inherited from

BaseTracer.ignoreChain

#### Defined in

[langchain/src/callbacks/base.ts:161](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L161)

### ignoreLLM

> **ignoreLLM**: `boolean` = `false`

#### Inherited from

BaseTracer.ignoreLLM

#### Defined in

[langchain/src/callbacks/base.ts:159](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L159)

### name

> **name**: `string` = `"langchain_tracer"`

#### Overrides

BaseTracer.name

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:272](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L272)

### endpoint

> `Protected` **endpoint**: `string`

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:274](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L274)

### executionOrder

> `Protected` **executionOrder**: `number` = `1`

#### Inherited from

BaseTracer.executionOrder

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:56](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L56)

### headers

> `Protected` **headers**: `Record`<`string`, `string`\>

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:280](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L280)

### runMap

> `Protected` **runMap**: `Map`<`string`, [`LLMRun`](../interfaces/LLMRun.md) \| [`ChainRun`](../interfaces/ChainRun.md) \| [`ToolRun`](../interfaces/ToolRun.md)\>

#### Inherited from

BaseTracer.runMap

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:54](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L54)

### session?

> **session**: `TracerSession`

#### Inherited from

BaseTracer.session

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:52](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L52)

## Methods

### copy()

> **copy**(): [`LangChainTracer`](LangChainTracer.md)

#### Returns

[`LangChainTracer`](LangChainTracer.md)

#### Overrides

BaseTracer.copy

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:380](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L380)

### handleChainEnd()

> **handleChainEnd**(`outputs`: [`ChainValues`](../../schema/types/ChainValues.md), `runId`: `string`): `Promise`<`void`\>

#### Parameters

| Parameter | Type                                               |
| :-------- | :------------------------------------------------- |
| `outputs` | [`ChainValues`](../../schema/types/ChainValues.md) |
| `runId`   | `string`                                           |

#### Returns

`Promise`<`void`\>

#### Inherited from

BaseTracer.handleChainEnd

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:198](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L198)

### handleChainError()

> **handleChainError**(`error`: `Error`, `runId`: `string`): `Promise`<`void`\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `error`   | `Error`  |
| `runId`   | `string` |

#### Returns

`Promise`<`void`\>

#### Inherited from

BaseTracer.handleChainError

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:209](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L209)

### handleChainStart()

> **handleChainStart**(`chain`: `object`, `inputs`: [`ChainValues`](../../schema/types/ChainValues.md), `runId`: `string`, `parentRunId`?: `string`): `Promise`<`void`\>

#### Parameters

| Parameter      | Type                                               |
| :------------- | :------------------------------------------------- |
| `chain`        | `object`                                           |
| `chain.name`   | `string`                                           |
| `inputs`       | [`ChainValues`](../../schema/types/ChainValues.md) |
| `runId`        | `string`                                           |
| `parentRunId?` | `string`                                           |

#### Returns

`Promise`<`void`\>

#### Inherited from

BaseTracer.handleChainStart

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:171](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L171)

### handleLLMEnd()

> **handleLLMEnd**(`output`: [`LLMResult`](../../schema/types/LLMResult.md), `runId`: `string`): `Promise`<`void`\>

#### Parameters

| Parameter | Type                                           |
| :-------- | :--------------------------------------------- |
| `output`  | [`LLMResult`](../../schema/types/LLMResult.md) |
| `runId`   | `string`                                       |

#### Returns

`Promise`<`void`\>

#### Inherited from

BaseTracer.handleLLMEnd

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:149](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L149)

### handleLLMError()

> **handleLLMError**(`error`: `Error`, `runId`: `string`): `Promise`<`void`\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `error`   | `Error`  |
| `runId`   | `string` |

#### Returns

`Promise`<`void`\>

#### Inherited from

BaseTracer.handleLLMError

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:160](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L160)

### handleLLMStart()

> **handleLLMStart**(`llm`: `object`, `prompts`: `string`[], `runId`: `string`, `parentRunId`?: `string`): `Promise`<`void`\>

#### Parameters

| Parameter      | Type       |
| :------------- | :--------- |
| `llm`          | `object`   |
| `llm.name`     | `string`   |
| `prompts`      | `string`[] |
| `runId`        | `string`   |
| `parentRunId?` | `string`   |

#### Returns

`Promise`<`void`\>

#### Inherited from

BaseTracer.handleLLMStart

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:125](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L125)

### handleToolEnd()

> **handleToolEnd**(`output`: `string`, `runId`: `string`): `Promise`<`void`\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `output`  | `string` |
| `runId`   | `string` |

#### Returns

`Promise`<`void`\>

#### Inherited from

BaseTracer.handleToolEnd

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:248](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L248)

### handleToolError()

> **handleToolError**(`error`: `Error`, `runId`: `string`): `Promise`<`void`\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `error`   | `Error`  |
| `runId`   | `string` |

#### Returns

`Promise`<`void`\>

#### Inherited from

BaseTracer.handleToolError

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:259](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L259)

### handleToolStart()

> **handleToolStart**(`tool`: `object`, `input`: `string`, `runId`: `string`, `parentRunId`?: `string`): `Promise`<`void`\>

#### Parameters

| Parameter      | Type     |
| :------------- | :------- |
| `tool`         | `object` |
| `tool.name`    | `string` |
| `input`        | `string` |
| `runId`        | `string` |
| `parentRunId?` | `string` |

#### Returns

`Promise`<`void`\>

#### Inherited from

BaseTracer.handleToolStart

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:220](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L220)

### loadDefaultSession()

> **loadDefaultSession**(): `Promise`<`TracerSession`\>

#### Returns

`Promise`<`TracerSession`\>

#### Overrides

BaseTracer.loadDefaultSession

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:344](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L344)

### loadSession()

> **loadSession**(`sessionName`: `string`): `Promise`<`TracerSession`\>

#### Parameters

| Parameter     | Type     |
| :------------ | :------- |
| `sessionName` | `string` |

#### Returns

`Promise`<`TracerSession`\>

#### Overrides

BaseTracer.loadSession

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:339](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L339)

### newSession()

> **newSession**(`sessionName`?: `string`): `Promise`<`TracerSession`\>

#### Parameters

| Parameter      | Type     |
| :------------- | :------- |
| `sessionName?` | `string` |

#### Returns

`Promise`<`TracerSession`\>

#### Inherited from

BaseTracer.newSession

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:74](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L74)

### handleAgentAction()?

Called when an agent is about to execute an action,
with the action and the run ID.

> `Optional` **handleAgentAction**(`action`: [`AgentAction`](../../schema/types/AgentAction.md), `runId`: `string`, `parentRunId`?: `string`): `void` \| `Promise`<`void`\>

#### Parameters

| Parameter      | Type                                               |
| :------------- | :------------------------------------------------- |
| `action`       | [`AgentAction`](../../schema/types/AgentAction.md) |
| `runId`        | `string`                                           |
| `parentRunId?` | `string`                                           |

#### Returns

`void` \| `Promise`<`void`\>

#### Inherited from

BaseTracer.handleAgentAction

#### Defined in

[langchain/src/callbacks/base.ts:125](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L125)

### handleAgentEnd()?

Called when an agent finishes execution, before it exits.
with the final output and the run ID.

> `Optional` **handleAgentEnd**(`action`: [`AgentFinish`](../../schema/types/AgentFinish.md), `runId`: `string`, `parentRunId`?: `string`): `void` \| `Promise`<`void`\>

#### Parameters

| Parameter      | Type                                               |
| :------------- | :------------------------------------------------- |
| `action`       | [`AgentFinish`](../../schema/types/AgentFinish.md) |
| `runId`        | `string`                                           |
| `parentRunId?` | `string`                                           |

#### Returns

`void` \| `Promise`<`void`\>

#### Inherited from

BaseTracer.handleAgentEnd

#### Defined in

[langchain/src/callbacks/base.ts:135](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L135)

### handleLLMNewToken()?

Called when an LLM/ChatModel in `streaming` mode produces a new token

> `Optional` **handleLLMNewToken**(`token`: `string`, `runId`: `string`, `parentRunId`?: `string`): `void` \| `Promise`<`void`\>

#### Parameters

| Parameter      | Type     |
| :------------- | :------- |
| `token`        | `string` |
| `runId`        | `string` |
| `parentRunId?` | `string` |

#### Returns

`void` \| `Promise`<`void`\>

#### Inherited from

BaseTracer.handleLLMNewToken

#### Defined in

[langchain/src/callbacks/base.ts:33](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L33)

### handleText()?

> `Optional` **handleText**(`text`: `string`, `runId`: `string`, `parentRunId`?: `string`): `void` \| `Promise`<`void`\>

#### Parameters

| Parameter      | Type     |
| :------------- | :------- |
| `text`         | `string` |
| `runId`        | `string` |
| `parentRunId?` | `string` |

#### Returns

`void` \| `Promise`<`void`\>

#### Inherited from

BaseTracer.handleText

#### Defined in

[langchain/src/callbacks/base.ts:115](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L115)

### fromMethods()

> `Static` **fromMethods**(`methods`: `BaseCallbackHandlerMethodsClass`): `Handler`

#### Parameters

| Parameter | Type                              |
| :-------- | :-------------------------------- |
| `methods` | `BaseCallbackHandlerMethodsClass` |

#### Returns

`Handler`

#### Inherited from

BaseTracer.fromMethods

#### Defined in

[langchain/src/callbacks/base.ts:180](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/base.ts#L180)

### \_addChildRun()

> `Protected` **\_addChildRun**(`parentRun`: [`ChainRun`](../interfaces/ChainRun.md) \| [`ToolRun`](../interfaces/ToolRun.md), `childRun`: [`LLMRun`](../interfaces/LLMRun.md) \| [`ChainRun`](../interfaces/ChainRun.md) \| [`ToolRun`](../interfaces/ToolRun.md)): `void`

#### Parameters

| Parameter   | Type                                                                                                                    |
| :---------- | :---------------------------------------------------------------------------------------------------------------------- |
| `parentRun` | [`ChainRun`](../interfaces/ChainRun.md) \| [`ToolRun`](../interfaces/ToolRun.md)                                        |
| `childRun`  | [`LLMRun`](../interfaces/LLMRun.md) \| [`ChainRun`](../interfaces/ChainRun.md) \| [`ToolRun`](../interfaces/ToolRun.md) |

#### Returns

`void`

#### Inherited from

BaseTracer.\_addChildRun

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:84](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L84)

### \_endTrace()

> `Protected` **\_endTrace**(`run`: [`LLMRun`](../interfaces/LLMRun.md) \| [`ChainRun`](../interfaces/ChainRun.md) \| [`ToolRun`](../interfaces/ToolRun.md)): `Promise`<`void`\>

#### Parameters

| Parameter | Type                                                                                                                    |
| :-------- | :---------------------------------------------------------------------------------------------------------------------- |
| `run`     | [`LLMRun`](../interfaces/LLMRun.md) \| [`ChainRun`](../interfaces/ChainRun.md) \| [`ToolRun`](../interfaces/ToolRun.md) |

#### Returns

`Promise`<`void`\>

#### Inherited from

BaseTracer.\_endTrace

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:117](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L117)

### \_startTrace()

> `Protected` **\_startTrace**(`run`: [`LLMRun`](../interfaces/LLMRun.md) \| [`ChainRun`](../interfaces/ChainRun.md) \| [`ToolRun`](../interfaces/ToolRun.md)): `void`

#### Parameters

| Parameter | Type                                                                                                                    |
| :-------- | :---------------------------------------------------------------------------------------------------------------------- |
| `run`     | [`LLMRun`](../interfaces/LLMRun.md) \| [`ChainRun`](../interfaces/ChainRun.md) \| [`ToolRun`](../interfaces/ToolRun.md) |

#### Returns

`void`

#### Inherited from

BaseTracer.\_startTrace

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:99](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L99)

### persistRun()

> `Protected` **persistRun**(`run`: [`LLMRun`](../interfaces/LLMRun.md) \| [`ChainRun`](../interfaces/ChainRun.md) \| [`ToolRun`](../interfaces/ToolRun.md)): `Promise`<`void`\>

#### Parameters

| Parameter | Type                                                                                                                    |
| :-------- | :---------------------------------------------------------------------------------------------------------------------- |
| `run`     | [`LLMRun`](../interfaces/LLMRun.md) \| [`ChainRun`](../interfaces/ChainRun.md) \| [`ToolRun`](../interfaces/ToolRun.md) |

#### Returns

`Promise`<`void`\>

#### Overrides

BaseTracer.persistRun

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:293](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L293)

### persistSession()

> `Protected` **persistSession**(`sessionCreate`: `BaseTracerSession`): `Promise`<`TracerSession`\>

#### Parameters

| Parameter       | Type                |
| :-------------- | :------------------ |
| `sessionCreate` | `BaseTracerSession` |

#### Returns

`Promise`<`TracerSession`\>

#### Overrides

BaseTracer.persistSession

#### Defined in

[langchain/src/callbacks/handlers/tracers.ts:315](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/callbacks/handlers/tracers.ts#L315)
