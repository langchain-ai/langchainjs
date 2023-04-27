---
title: "SqlDatabaseChain"
---

# SqlDatabaseChain

Base interface that all chains must implement.

## Hierarchy

- [`BaseChain`](BaseChain.md).**SqlDatabaseChain**

## Constructors

### constructor()

> **new SqlDatabaseChain**(`fields`: [`SqlDatabaseChainInput`](../interfaces/SqlDatabaseChainInput.md)): [`SqlDatabaseChain`](SqlDatabaseChain.md)

#### Parameters

| Parameter | Type                                                              |
| :-------- | :---------------------------------------------------------------- |
| `fields`  | [`SqlDatabaseChainInput`](../interfaces/SqlDatabaseChainInput.md) |

#### Returns

[`SqlDatabaseChain`](SqlDatabaseChain.md)

#### Overrides

[BaseChain](BaseChain.md).[constructor](BaseChain.md#constructor)

#### Defined in

[langchain/src/chains/sql_db/sql_db_chain.ts:44](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sql_db/sql_db_chain.ts#L44)

## Properties

### database

> **database**: [`SqlDatabase`](../../sql_db/classes/SqlDatabase.md)

#### Defined in

[langchain/src/chains/sql_db/sql_db_chain.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sql_db/sql_db_chain.ts#L29)

### inputKey

> **inputKey**: `string` = `"query"`

#### Defined in

[langchain/src/chains/sql_db/sql_db_chain.ts:37](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sql_db/sql_db_chain.ts#L37)

### llm

> **llm**: [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md)

#### Defined in

[langchain/src/chains/sql_db/sql_db_chain.ts:26](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sql_db/sql_db_chain.ts#L26)

### outputKey

> **outputKey**: `string` = `"result"`

#### Defined in

[langchain/src/chains/sql_db/sql_db_chain.ts:39](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sql_db/sql_db_chain.ts#L39)

### prompt

> **prompt**: [`PromptTemplate`](../../prompts/classes/PromptTemplate.md) = `DEFAULT_SQL_DATABASE_PROMPT`

#### Defined in

[langchain/src/chains/sql_db/sql_db_chain.ts:32](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sql_db/sql_db_chain.ts#L32)

### returnDirect

> **returnDirect**: `boolean` = `false`

#### Defined in

[langchain/src/chains/sql_db/sql_db_chain.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sql_db/sql_db_chain.ts#L42)

### topK

> **topK**: `number` = `5`

#### Defined in

[langchain/src/chains/sql_db/sql_db_chain.ts:35](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sql_db/sql_db_chain.ts#L35)

### verbose

> **verbose**: `boolean`

Whether to print out response text.

#### Inherited from

[BaseChain](BaseChain.md).[verbose](BaseChain.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L27)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Inherited from

[BaseChain](BaseChain.md).[callbacks](BaseChain.md#callbacks)

#### Defined in

[langchain/src/base_language/index.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L29)

### memory?

> **memory**: [`BaseMemory`](../../memory/classes/BaseMemory.md)

#### Inherited from

[BaseChain](BaseChain.md).[memory](BaseChain.md#memory)

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

[langchain/src/chains/sql_db/sql_db_chain.ts:118](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sql_db/sql_db_chain.ts#L118)

#### Overrides

[BaseChain](BaseChain.md).[inputKeys](BaseChain.md#inputkeys)

#### Defined in

[langchain/src/chains/sql_db/sql_db_chain.ts:118](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sql_db/sql_db_chain.ts#L118)

### outputKeys

> **outputKeys**(): `string`[]

#### Returns

`string`[]

#### Overrides

BaseChain.outputKeys

#### Defined in

[langchain/src/chains/sql_db/sql_db_chain.ts:122](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sql_db/sql_db_chain.ts#L122)

#### Overrides

[BaseChain](BaseChain.md).[outputKeys](BaseChain.md#outputkeys)

#### Defined in

[langchain/src/chains/sql_db/sql_db_chain.ts:122](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sql_db/sql_db_chain.ts#L122)

## Methods

### \_chainType()

Return the string type key uniquely identifying this class of chain.

> **\_chainType**(): "sql_database_chain"

#### Returns

"sql_database_chain"

#### Overrides

[BaseChain](BaseChain.md).[\_chainType](BaseChain.md#_chaintype)

#### Defined in

[langchain/src/chains/sql_db/sql_db_chain.ts:114](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sql_db/sql_db_chain.ts#L114)

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

[BaseChain](BaseChain.md).[apply](BaseChain.md#apply)

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

[BaseChain](BaseChain.md).[call](BaseChain.md#call)

#### Defined in

[langchain/src/chains/base.ts:84](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L84)

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

[BaseChain](BaseChain.md).[run](BaseChain.md#run)

#### Defined in

[langchain/src/chains/base.ts:56](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L56)

### serialize()

Return a json-like object representing this chain.

> **serialize**(): [`SerializedSqlDatabaseChain`](../types/SerializedSqlDatabaseChain.md)

#### Returns

[`SerializedSqlDatabaseChain`](../types/SerializedSqlDatabaseChain.md)

#### Overrides

[BaseChain](BaseChain.md).[serialize](BaseChain.md#serialize)

#### Defined in

[langchain/src/chains/sql_db/sql_db_chain.ts:139](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sql_db/sql_db_chain.ts#L139)

### deserialize()

Load a chain from a json-like object describing it.

> `Static` **deserialize**(`data`: [`SerializedSqlDatabaseChain`](../types/SerializedSqlDatabaseChain.md), `SqlDatabaseFromOptionsParams`: `Function`): `Promise`<[`SqlDatabaseChain`](SqlDatabaseChain.md)\>

#### Parameters

| Parameter                      | Type                                                                                                                                                               |
| :----------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data`                         | [`SerializedSqlDatabaseChain`](../types/SerializedSqlDatabaseChain.md)                                                                                             |
| `SqlDatabaseFromOptionsParams` | (`fields`: [`SqlDatabaseOptionsParams`](../../sql_db/interfaces/SqlDatabaseOptionsParams.md)) => `Promise`<[`SqlDatabase`](../../sql_db/classes/SqlDatabase.md)\> |

#### Returns

`Promise`<[`SqlDatabaseChain`](SqlDatabaseChain.md)\>

#### Overrides

[BaseChain](BaseChain.md).[deserialize](BaseChain.md#deserialize)

#### Defined in

[langchain/src/chains/sql_db/sql_db_chain.ts:126](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sql_db/sql_db_chain.ts#L126)
