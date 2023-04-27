---
title: "SqlDatabaseChainInput"
---

# SqlDatabaseChainInput

## Hierarchy

- [`ChainInputs`](ChainInputs.md).**SqlDatabaseChainInput**

## Properties

### database

> **database**: [`SqlDatabase`](../../sql_db/classes/SqlDatabase.md)

#### Defined in

[langchain/src/chains/sql_db/sql_db_chain.ts:18](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sql_db/sql_db_chain.ts#L18)

### llm

> **llm**: [`BaseLanguageModel`](../../base_language/classes/BaseLanguageModel.md)

#### Defined in

[langchain/src/chains/sql_db/sql_db_chain.ts:17](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sql_db/sql_db_chain.ts#L17)

### callbackManager?

> **callbackManager**: [`CallbackManager`](../../callbacks/classes/CallbackManager.md)

#### Deprecated

Use `callbacks` instead

#### Inherited from

[ChainInputs](ChainInputs.md).[callbackManager](ChainInputs.md#callbackmanager)

#### Defined in

[langchain/src/chains/base.ts:20](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L20)

### callbacks?

> **callbacks**: [`Callbacks`](../../callbacks/types/Callbacks.md)

#### Inherited from

[ChainInputs](ChainInputs.md).[callbacks](ChainInputs.md#callbacks)

#### Defined in

[langchain/src/base_language/index.ts:17](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L17)

### inputKey?

> **inputKey**: `string`

#### Defined in

[langchain/src/chains/sql_db/sql_db_chain.ts:20](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sql_db/sql_db_chain.ts#L20)

### memory?

> **memory**: [`BaseMemory`](../../memory/classes/BaseMemory.md)

#### Inherited from

[ChainInputs](ChainInputs.md).[memory](ChainInputs.md#memory)

#### Defined in

[langchain/src/chains/base.ts:15](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/base.ts#L15)

### outputKey?

> **outputKey**: `string`

#### Defined in

[langchain/src/chains/sql_db/sql_db_chain.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sql_db/sql_db_chain.ts#L21)

### topK?

> **topK**: `number`

#### Defined in

[langchain/src/chains/sql_db/sql_db_chain.ts:19](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/chains/sql_db/sql_db_chain.ts#L19)

### verbose?

> **verbose**: `boolean`

#### Inherited from

[ChainInputs](ChainInputs.md).[verbose](ChainInputs.md#verbose)

#### Defined in

[langchain/src/base_language/index.ts:16](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/base_language/index.ts#L16)
