---
title: "BabyAGI"
---

# BabyAGI

Base interface that all chains must implement.

## Hierarchy

- [`BaseChain`](../../chains/classes/BaseChain.md).**BabyAGI**

## Implements

- [`BabyAGIInputs`](../interfaces/BabyAGIInputs.md)

## Constructors

### constructor()

> **new BabyAGI**(«destructured»: [`BabyAGIInputs`](../interfaces/BabyAGIInputs.md)): [`BabyAGI`](BabyAGI.md)

#### Parameters

| Parameter        | Type                                              |
| :--------------- | :------------------------------------------------ |
| `«destructured»` | [`BabyAGIInputs`](../interfaces/BabyAGIInputs.md) |

#### Returns

[`BabyAGI`](BabyAGI.md)

#### Overrides

[BaseChain](../../chains/classes/BaseChain.md).[constructor](../../chains/classes/BaseChain.md#constructor)

#### Defined in

[langchain/src/experimental/babyagi/agent.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/babyagi/agent.ts#L42)

## Properties

### creationChain

> **creationChain**: [`BaseChain`](../../chains/classes/BaseChain.md)

#### Implementation of

[BabyAGIInputs](../interfaces/BabyAGIInputs.md).[creationChain](../interfaces/BabyAGIInputs.md#creationchain)

#### Defined in

[langchain/src/experimental/babyagi/agent.ts:30](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/babyagi/agent.ts#L30)

### executionChain

> **executionChain**: [`BaseChain`](../../chains/classes/BaseChain.md)

#### Implementation of

[BabyAGIInputs](../interfaces/BabyAGIInputs.md).[executionChain](../interfaces/BabyAGIInputs.md#executionchain)

#### Defined in

[langchain/src/experimental/babyagi/agent.ts:34](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/babyagi/agent.ts#L34)

### maxIterations

> **maxIterations**: `number`

#### Implementation of

[BabyAGIInputs](../interfaces/BabyAGIInputs.md).[maxIterations](../interfaces/BabyAGIInputs.md#maxiterations)

#### Defined in

[langchain/src/experimental/babyagi/agent.ts:40](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/babyagi/agent.ts#L40)

### prioritizationChain

> **prioritizationChain**: [`BaseChain`](../../chains/classes/BaseChain.md)

#### Implementation of

[BabyAGIInputs](../interfaces/BabyAGIInputs.md).[prioritizationChain](../interfaces/BabyAGIInputs.md#prioritizationchain)

#### Defined in

[langchain/src/experimental/babyagi/agent.ts:32](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/babyagi/agent.ts#L32)

### taskIDCounter

> **taskIDCounter**: `number`

#### Defined in

[langchain/src/experimental/babyagi/agent.ts:36](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/babyagi/agent.ts#L36)

### taskList

> **taskList**: [`Task`](../interfaces/Task.md)[]

#### Defined in

[langchain/src/experimental/babyagi/agent.ts:28](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/babyagi/agent.ts#L28)

### vectorstore

> **vectorstore**: [`VectorStore`](../../vectorstores_base/classes/VectorStore.md)

#### Implementation of

[BabyAGIInputs](../interfaces/BabyAGIInputs.md).[vectorstore](../interfaces/BabyAGIInputs.md#vectorstore)

#### Defined in

[langchain/src/experimental/babyagi/agent.ts:38](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/babyagi/agent.ts#L38)

### verbose

> **verbose**: `boolean`

Whether to print out response text.

#### Implementation of

[BabyAGIInputs](../interfaces/BabyAGIInputs.md).[verbose](../interfaces/BabyAGIInputs.md#verbose)

#### Inherited from

[BaseChain](../../chains/classes/BaseChain.md).[verbose](../../chains/classes/BaseChain.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L27)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Implementation of

[BabyAGIInputs](../interfaces/BabyAGIInputs.md).[callbacks](../interfaces/BabyAGIInputs.md#callbacks)

#### Inherited from

[BaseChain](../../chains/classes/BaseChain.md).[callbacks](../../chains/classes/BaseChain.md#callbacks)

#### Defined in

[langchain/src/base_language/index.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L29)

### memory?

> **memory**: [`BaseMemory`](../../memory/classes/BaseMemory.md)

#### Inherited from

[BaseChain](../../chains/classes/BaseChain.md).[memory](../../chains/classes/BaseChain.md#memory)

#### Defined in

[langchain/src/chains/base.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L27)

## Accessors

### inputKeys

> **inputKeys**(): `string`[]

#### Returns

`string`[]

#### Overrides

BaseChain.inputKeys

#### Defined in

[langchain/src/experimental/babyagi/agent.ts:65](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/babyagi/agent.ts#L65)

#### Overrides

[BaseChain](../../chains/classes/BaseChain.md).[inputKeys](../../chains/classes/BaseChain.md#inputkeys)

#### Defined in

[langchain/src/experimental/babyagi/agent.ts:65](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/babyagi/agent.ts#L65)

### outputKeys

> **outputKeys**(): `never`[]

#### Returns

`never`[]

#### Overrides

BaseChain.outputKeys

#### Defined in

[langchain/src/experimental/babyagi/agent.ts:69](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/babyagi/agent.ts#L69)

#### Overrides

[BaseChain](../../chains/classes/BaseChain.md).[outputKeys](../../chains/classes/BaseChain.md#outputkeys)

#### Defined in

[langchain/src/experimental/babyagi/agent.ts:69](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/babyagi/agent.ts#L69)

## Methods

### \_call()

Run the core logic of this chain and return the output

> **\_call**(«destructured»: [`ChainValues`](../../schema/types/ChainValues.md), `runManager`?: [`CallbackManagerForChainRun`](../../callbacks/classes/CallbackManagerForChainRun.md)): `Promise`<\{}\>

#### Parameters

| Parameter        | Type                                                                                  |
| :--------------- | :------------------------------------------------------------------------------------ |
| `«destructured»` | [`ChainValues`](../../schema/types/ChainValues.md)                                    |
| `runManager?`    | [`CallbackManagerForChainRun`](../../callbacks/classes/CallbackManagerForChainRun.md) |

#### Returns

`Promise`<\{}\>

#### Overrides

[BaseChain](../../chains/classes/BaseChain.md).[\_call](../../chains/classes/BaseChain.md#_call)

#### Defined in

[langchain/src/experimental/babyagi/agent.ts:173](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/babyagi/agent.ts#L173)

### \_chainType()

Return the string type key uniquely identifying this class of chain.

> **\_chainType**(): "BabyAGI"

#### Returns

"BabyAGI"

#### Overrides

[BaseChain](../../chains/classes/BaseChain.md).[\_chainType](../../chains/classes/BaseChain.md#_chaintype)

#### Defined in

[langchain/src/experimental/babyagi/agent.ts:61](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/babyagi/agent.ts#L61)

### addTask()

> **addTask**(`task`: [`Task`](../interfaces/Task.md)): `Promise`<`void`\>

#### Parameters

| Parameter | Type                            |
| :-------- | :------------------------------ |
| `task`    | [`Task`](../interfaces/Task.md) |

#### Returns

`Promise`<`void`\>

#### Defined in

[langchain/src/experimental/babyagi/agent.ts:73](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/babyagi/agent.ts#L73)

### apply()

Call the chain on all inputs in the list

> **apply**(`inputs`: [`ChainValues`](../../schema/types/ChainValues.md)[], `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)[]): `Promise`<[`ChainValues`](../../schema/types/ChainValues.md)\>

#### Parameters

| Parameter    | Type                                                 |
| :----------- | :--------------------------------------------------- |
| `inputs`     | [`ChainValues`](../../schema/types/ChainValues.md)[] |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md)[]  |

#### Returns

`Promise`<[`ChainValues`](../../schema/types/ChainValues.md)\>

#### Inherited from

[BaseChain](../../chains/classes/BaseChain.md).[apply](../../chains/classes/BaseChain.md#apply)

#### Defined in

[langchain/src/chains/base.ts:123](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L123)

### call()

Run the core logic of this chain and add to output if desired.

Wraps \_call and handles memory.

> **call**(`values`: [`ChainValues`](../../schema/types/ChainValues.md), `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<[`ChainValues`](../../schema/types/ChainValues.md)\>

#### Parameters

| Parameter    | Type                                               |
| :----------- | :------------------------------------------------- |
| `values`     | [`ChainValues`](../../schema/types/ChainValues.md) |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md)  |

#### Returns

`Promise`<[`ChainValues`](../../schema/types/ChainValues.md)\>

#### Inherited from

[BaseChain](../../chains/classes/BaseChain.md).[call](../../chains/classes/BaseChain.md#call)

#### Defined in

[langchain/src/chains/base.ts:84](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L84)

### executeTask()

> **executeTask**(`objective`: `string`, `task`: `string`, `runManager`?: [`CallbackManagerForChainRun`](../../callbacks/classes/CallbackManagerForChainRun.md)): `Promise`<`string`\>

#### Parameters

| Parameter     | Type                                                                                  |
| :------------ | :------------------------------------------------------------------------------------ |
| `objective`   | `string`                                                                              |
| `task`        | `string`                                                                              |
| `runManager?` | [`CallbackManagerForChainRun`](../../callbacks/classes/CallbackManagerForChainRun.md) |

#### Returns

`Promise`<`string`\>

#### Defined in

[langchain/src/experimental/babyagi/agent.ts:155](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/babyagi/agent.ts#L155)

### getNextTasks()

> **getNextTasks**(`result`: `string`, `task_description`: `string`, `objective`: `string`, `runManager`?: [`CallbackManagerForChainRun`](../../callbacks/classes/CallbackManagerForChainRun.md)): `Promise`<`Optional`<[`Task`](../interfaces/Task.md), "taskID"\>[]\>

#### Parameters

| Parameter          | Type                                                                                  |
| :----------------- | :------------------------------------------------------------------------------------ |
| `result`           | `string`                                                                              |
| `task_description` | `string`                                                                              |
| `objective`        | `string`                                                                              |
| `runManager?`      | [`CallbackManagerForChainRun`](../../callbacks/classes/CallbackManagerForChainRun.md) |

#### Returns

`Promise`<`Optional`<[`Task`](../interfaces/Task.md), "taskID"\>[]\>

#### Defined in

[langchain/src/experimental/babyagi/agent.ts:94](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/babyagi/agent.ts#L94)

### getTopTasks()

> **getTopTasks**(`query`: `string`, `k`: `number` = `5`): `Promise`<`string`[]\>

#### Parameters

| Parameter | Type     | Default value |
| :-------- | :------- | :------------ |
| `query`   | `string` | `undefined`   |
| `k`       | `number` | `5`           |

#### Returns

`Promise`<`string`[]\>

#### Defined in

[langchain/src/experimental/babyagi/agent.ts:147](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/babyagi/agent.ts#L147)

### printNextTask()

> **printNextTask**(`task`: [`Task`](../interfaces/Task.md)): `void`

#### Parameters

| Parameter | Type                            |
| :-------- | :------------------------------ |
| `task`    | [`Task`](../interfaces/Task.md) |

#### Returns

`void`

#### Defined in

[langchain/src/experimental/babyagi/agent.ts:84](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/babyagi/agent.ts#L84)

### printTaskList()

> **printTaskList**(): `void`

#### Returns

`void`

#### Defined in

[langchain/src/experimental/babyagi/agent.ts:77](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/babyagi/agent.ts#L77)

### printTaskResult()

> **printTaskResult**(`result`: `string`): `void`

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `result`  | `string` |

#### Returns

`void`

#### Defined in

[langchain/src/experimental/babyagi/agent.ts:89](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/babyagi/agent.ts#L89)

### prioritizeTasks()

> **prioritizeTasks**(`thisTaskID`: `number`, `objective`: `string`, `runManager`?: [`CallbackManagerForChainRun`](../../callbacks/classes/CallbackManagerForChainRun.md)): `Promise`<\{`taskID`: `string`;
> `taskName`: `string`;}[]\>

#### Parameters

| Parameter     | Type                                                                                  |
| :------------ | :------------------------------------------------------------------------------------ |
| `thisTaskID`  | `number`                                                                              |
| `objective`   | `string`                                                                              |
| `runManager?` | [`CallbackManagerForChainRun`](../../callbacks/classes/CallbackManagerForChainRun.md) |

#### Returns

`Promise`<\{`taskID`: `string`;
`taskName`: `string`;}[]\>

#### Defined in

[langchain/src/experimental/babyagi/agent.ts:118](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/babyagi/agent.ts#L118)

### run()

> **run**(`input`: `any`, `callbacks`?: [`Callbacks`](../../callbacks/types/Callbacks.md)): `Promise`<`string`\>

#### Parameters

| Parameter    | Type                                              |
| :----------- | :------------------------------------------------ |
| `input`      | `any`                                             |
| `callbacks?` | [`Callbacks`](../../callbacks/types/Callbacks.md) |

#### Returns

`Promise`<`string`\>

#### Inherited from

[BaseChain](../../chains/classes/BaseChain.md).[run](../../chains/classes/BaseChain.md#run)

#### Defined in

[langchain/src/chains/base.ts:56](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L56)

### serialize()

Return a json-like object representing this chain.

> **serialize**(): [`SerializedBaseChain`](../../chains/types/SerializedBaseChain.md)

#### Returns

[`SerializedBaseChain`](../../chains/types/SerializedBaseChain.md)

#### Overrides

[BaseChain](../../chains/classes/BaseChain.md).[serialize](../../chains/classes/BaseChain.md#serialize)

#### Defined in

[langchain/src/experimental/babyagi/agent.ts:226](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/babyagi/agent.ts#L226)

### deserialize()

Load a chain from a json-like object describing it.

> `Static` **deserialize**(`data`: [`SerializedBaseChain`](../../chains/types/SerializedBaseChain.md), `values`: `LoadValues` = `{}`): `Promise`<[`BaseChain`](../../chains/classes/BaseChain.md)\>

#### Parameters

| Parameter | Type                                                               |
| :-------- | :----------------------------------------------------------------- |
| `data`    | [`SerializedBaseChain`](../../chains/types/SerializedBaseChain.md) |
| `values`  | `LoadValues`                                                       |

#### Returns

`Promise`<[`BaseChain`](../../chains/classes/BaseChain.md)\>

#### Inherited from

[BaseChain](../../chains/classes/BaseChain.md).[deserialize](../../chains/classes/BaseChain.md#deserialize)

#### Defined in

[langchain/src/chains/base.ts:135](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L135)

### fromLLM()

> `Static` **fromLLM**(«destructured»: `Omit`<[`BabyAGIInputs`](../interfaces/BabyAGIInputs.md), "creationChain" \| "prioritizationChain" \| "executionChain"\> & `Partial`<`Pick`<[`BabyAGIInputs`](../interfaces/BabyAGIInputs.md), "creationChain" \| "prioritizationChain" \| "executionChain"\>\> & \{`llm`: [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md);}): [`BabyAGI`](BabyAGI.md)

#### Parameters

| Parameter        | Type                                                                                                                                                                                                                                                                                                                                                    |
| :--------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `«destructured»` | `Omit`<[`BabyAGIInputs`](../interfaces/BabyAGIInputs.md), "creationChain" \| "prioritizationChain" \| "executionChain"\> & `Partial`<`Pick`<[`BabyAGIInputs`](../interfaces/BabyAGIInputs.md), "creationChain" \| "prioritizationChain" \| "executionChain"\>\> & \{`llm`: [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md);} |

#### Returns

[`BabyAGI`](BabyAGI.md)

#### Defined in

[langchain/src/experimental/babyagi/agent.ts:230](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/experimental/babyagi/agent.ts#L230)
