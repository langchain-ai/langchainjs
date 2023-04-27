---
title: "SqlDatabase"
---

# SqlDatabase

## Implements

- [`SqlDatabaseOptionsParams`](../interfaces/SqlDatabaseOptionsParams.md)
- [`SqlDatabaseDataSourceParams`](../interfaces/SqlDatabaseDataSourceParams.md)

## Constructors

### constructor()

> `Protected` **new SqlDatabase**(`fields`: [`SqlDatabaseDataSourceParams`](../interfaces/SqlDatabaseDataSourceParams.md)): [`SqlDatabase`](SqlDatabase.md)

#### Parameters

| Parameter | Type                                                                          |
| :-------- | :---------------------------------------------------------------------------- |
| `fields`  | [`SqlDatabaseDataSourceParams`](../interfaces/SqlDatabaseDataSourceParams.md) |

#### Returns

[`SqlDatabase`](SqlDatabase.md)

#### Defined in

[langchain/src/sql_db.ts:31](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/sql_db.ts#L31)

## Properties

### allTables

> **allTables**: `SqlTable`[] = `[]`

#### Defined in

[langchain/src/sql_db.ts:23](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/sql_db.ts#L23)

### appDataSource

> **appDataSource**: `DataSource`

#### Implementation of

[SqlDatabaseDataSourceParams](../interfaces/SqlDatabaseDataSourceParams.md).[appDataSource](../interfaces/SqlDatabaseDataSourceParams.md#appdatasource)

#### Defined in

[langchain/src/sql_db.ts:21](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/sql_db.ts#L21)

### appDataSourceOptions

> **appDataSourceOptions**: `DataSourceOptions`

#### Implementation of

[SqlDatabaseOptionsParams](../interfaces/SqlDatabaseOptionsParams.md).[appDataSourceOptions](../interfaces/SqlDatabaseOptionsParams.md#appdatasourceoptions)

#### Defined in

[langchain/src/sql_db.ts:19](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/sql_db.ts#L19)

### ignoreTables

> **ignoreTables**: `string`[] = `[]`

#### Implementation of

[SqlDatabaseDataSourceParams](../interfaces/SqlDatabaseDataSourceParams.md).[ignoreTables](../interfaces/SqlDatabaseDataSourceParams.md#ignoretables)

#### Defined in

[langchain/src/sql_db.ts:27](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/sql_db.ts#L27)

### includesTables

> **includesTables**: `string`[] = `[]`

#### Implementation of

[SqlDatabaseDataSourceParams](../interfaces/SqlDatabaseDataSourceParams.md).[includesTables](../interfaces/SqlDatabaseDataSourceParams.md#includestables)

#### Defined in

[langchain/src/sql_db.ts:25](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/sql_db.ts#L25)

### sampleRowsInTableInfo

> **sampleRowsInTableInfo**: `number` = `3`

#### Implementation of

[SqlDatabaseDataSourceParams](../interfaces/SqlDatabaseDataSourceParams.md).[sampleRowsInTableInfo](../interfaces/SqlDatabaseDataSourceParams.md#samplerowsintableinfo)

#### Defined in

[langchain/src/sql_db.ts:29](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/sql_db.ts#L29)

## Methods

### getTableInfo()

Get information about specified tables.

Follows best practices as specified in: Rajkumar et al, 2022
(https://arxiv.org/abs/2204.00498)

If `sample_rows_in_table_info`, the specified number of sample rows will be
appended to each table description. This can increase performance as
demonstrated in the paper.

> **getTableInfo**(`targetTables`?: `string`[]): `Promise`<`string`\>

#### Parameters

| Parameter       | Type       |
| :-------------- | :--------- |
| `targetTables?` | `string`[] |

#### Returns

`Promise`<`string`\>

#### Defined in

[langchain/src/sql_db.ts:85](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/sql_db.ts#L85)

### run()

Execute a SQL command and return a string representing the results.
If the statement returns rows, a string of the results is returned.
If the statement returns no rows, an empty string is returned.

> **run**(`command`: `string`, `fetch`: "all" \| "one" = `"all"`): `Promise`<`string`\>

#### Parameters

| Parameter | Type           | Default value |
| :-------- | :------------- | :------------ |
| `command` | `string`       | `undefined`   |
| `fetch`   | "all" \| "one" | `"all"`       |

#### Returns

`Promise`<`string`\>

#### Defined in

[langchain/src/sql_db.ts:122](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/sql_db.ts#L122)

### serialize()

> **serialize**(): `SerializedSqlDatabase`

#### Returns

`SerializedSqlDatabase`

#### Defined in

[langchain/src/sql_db.ts:137](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/sql_db.ts#L137)

### fromDataSourceParams()

> `Static` **fromDataSourceParams**(`fields`: [`SqlDatabaseDataSourceParams`](../interfaces/SqlDatabaseDataSourceParams.md)): `Promise`<[`SqlDatabase`](SqlDatabase.md)\>

#### Parameters

| Parameter | Type                                                                          |
| :-------- | :---------------------------------------------------------------------------- |
| `fields`  | [`SqlDatabaseDataSourceParams`](../interfaces/SqlDatabaseDataSourceParams.md) |

#### Returns

`Promise`<[`SqlDatabase`](SqlDatabase.md)\>

#### Defined in

[langchain/src/sql_db.ts:43](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/sql_db.ts#L43)

### fromOptionsParams()

> `Static` **fromOptionsParams**(`fields`: [`SqlDatabaseOptionsParams`](../interfaces/SqlDatabaseOptionsParams.md)): `Promise`<[`SqlDatabase`](SqlDatabase.md)\>

#### Parameters

| Parameter | Type                                                                    |
| :-------- | :---------------------------------------------------------------------- |
| `fields`  | [`SqlDatabaseOptionsParams`](../interfaces/SqlDatabaseOptionsParams.md) |

#### Returns

`Promise`<[`SqlDatabase`](SqlDatabase.md)\>

#### Defined in

[langchain/src/sql_db.ts:64](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/sql_db.ts#L64)
