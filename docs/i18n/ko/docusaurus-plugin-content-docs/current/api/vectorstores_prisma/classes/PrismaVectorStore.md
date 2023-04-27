---
title: "PrismaVectorStore<TModel, TModelName, TSelectModel>"
---

# PrismaVectorStore<TModel, TModelName, TSelectModel\>

## Type parameters

- `TModel` _extends_ `Record`<`string`, `unknown`\>
- `TModelName` _extends_ `string`
- `TSelectModel` _extends_ `ModelColumns`<`TModel`\>

## Hierarchy

- [`VectorStore`](../../vectorstores_base/classes/VectorStore.md).**PrismaVectorStore**

## Constructors

### constructor()

> **new PrismaVectorStore**<TModel, TModelName, TSelectModel\>(`embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `config`: `object`): [`PrismaVectorStore`](PrismaVectorStore.md)<`TModel`, `TModelName`, `TSelectModel`\>

#### Type parameters

- `TModel` _extends_ `Record`<`string`, `unknown`\>
- `TModelName` _extends_ `string`
- `TSelectModel` _extends_ `ModelColumns`<`TModel`\>

#### Parameters

| Parameter                 | Type                                                        |
| :------------------------ | :---------------------------------------------------------- |
| `embeddings`              | [`Embeddings`](../../embeddings_base/classes/Embeddings.md) |
| `config`                  | `object`                                                    |
| `config.columns`          | `TSelectModel`                                              |
| `config.db`               | `PrismaClient`                                              |
| `config.prisma`           | `PrismaNamespace`                                           |
| `config.tableName`        | `TModelName`                                                |
| `config.vectorColumnName` | `string`                                                    |

#### Returns

[`PrismaVectorStore`](PrismaVectorStore.md)<`TModel`, `TModelName`, `TSelectModel`\>

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[constructor](../../vectorstores_base/classes/VectorStore.md#constructor)

#### Defined in

[langchain/src/vectorstores/prisma.ts:89](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/prisma.ts#L89)

## Properties

### FilterType

> **FilterType**: `object`

#### Inherited from

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[FilterType](../../vectorstores_base/classes/VectorStore.md#filtertype)

#### Defined in

[langchain/src/vectorstores/base.ts:40](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L40)

### contentColumn

> **contentColumn**: _keyof_ `TModel` & `string`

#### Defined in

[langchain/src/vectorstores/prisma.ts:79](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/prisma.ts#L79)

### embeddings

> **embeddings**: [`Embeddings`](../../embeddings_base/classes/Embeddings.md)

#### Inherited from

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[embeddings](../../vectorstores_base/classes/VectorStore.md#embeddings)

#### Defined in

[langchain/src/vectorstores/base.ts:42](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L42)

### idColumn

> **idColumn**: _keyof_ `TModel` & `string`

#### Defined in

[langchain/src/vectorstores/prisma.ts:77](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/prisma.ts#L77)

### selectSql

> **selectSql**: `Sql`

#### Defined in

[langchain/src/vectorstores/prisma.ts:75](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/prisma.ts#L75)

### tableSql

> **tableSql**: `Sql`

#### Defined in

[langchain/src/vectorstores/prisma.ts:71](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/prisma.ts#L71)

### vectorColumnSql

> **vectorColumnSql**: `Sql`

#### Defined in

[langchain/src/vectorstores/prisma.ts:73](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/prisma.ts#L73)

### ContentColumn

> `Static` **ContentColumn**: _typeof_ `ContentColumnSymbol` = `ContentColumnSymbol`

#### Defined in

[langchain/src/vectorstores/prisma.ts:83](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/prisma.ts#L83)

### IdColumn

> `Static` **IdColumn**: _typeof_ `IdColumnSymbol` = `IdColumnSymbol`

#### Defined in

[langchain/src/vectorstores/prisma.ts:81](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/prisma.ts#L81)

### Prisma

> `Protected` **Prisma**: `PrismaNamespace`

#### Defined in

[langchain/src/vectorstores/prisma.ts:87](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/prisma.ts#L87)

### db

> `Protected` **db**: `PrismaClient`

#### Defined in

[langchain/src/vectorstores/prisma.ts:85](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/prisma.ts#L85)

## Methods

### addDocuments()

> **addDocuments**(`documents`: [`Document`](../../document/classes/Document.md)<`TModel`\>[]): `Promise`<`void`\>

#### Parameters

| Parameter   | Type                                                           |
| :---------- | :------------------------------------------------------------- |
| `documents` | [`Document`](../../document/classes/Document.md)<`TModel`\>[] |

#### Returns

`Promise`<`void`\>

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[addDocuments](../../vectorstores_base/classes/VectorStore.md#adddocuments)

#### Defined in

[langchain/src/vectorstores/prisma.ts:214](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/prisma.ts#L214)

### addModels()

> **addModels**(`models`: `TModel`[]): `Promise`<`void`\>

#### Parameters

| Parameter | Type       |
| :-------- | :--------- |
| `models`  | `TModel`[] |

#### Returns

`Promise`<`void`\>

#### Defined in

[langchain/src/vectorstores/prisma.ts:203](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/prisma.ts#L203)

### addVectors()

> **addVectors**(`vectors`: `number`[][], `documents`: [`Document`](../../document/classes/Document.md)<`TModel`\>[]): `Promise`<`void`\>

#### Parameters

| Parameter   | Type                                                           |
| :---------- | :------------------------------------------------------------- |
| `vectors`   | `number`[][]                                                   |
| `documents` | [`Document`](../../document/classes/Document.md)<`TModel`\>[] |

#### Returns

`Promise`<`void`\>

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[addVectors](../../vectorstores_base/classes/VectorStore.md#addvectors)

#### Defined in

[langchain/src/vectorstores/prisma.ts:222](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/prisma.ts#L222)

### asRetriever()

> **asRetriever**(`k`?: `number`, `filter`?: `object`): [`VectorStoreRetriever`](../../vectorstores_base/classes/VectorStoreRetriever.md)<[`PrismaVectorStore`](PrismaVectorStore.md)<`TModel`, `TModelName`, `TSelectModel`\>\>

#### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `k?`      | `number` |
| `filter?` | `object` |

#### Returns

[`VectorStoreRetriever`](../../vectorstores_base/classes/VectorStoreRetriever.md)<[`PrismaVectorStore`](PrismaVectorStore.md)<`TModel`, `TModelName`, `TSelectModel`\>\>

#### Inherited from

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[asRetriever](../../vectorstores_base/classes/VectorStore.md#asretriever)

#### Defined in

[langchain/src/vectorstores/base.ts:111](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L111)

### similaritySearch()

> **similaritySearch**(`query`: `string`, `k`: `number` = `4`): `Promise`<[`Document`](../../document/classes/Document.md)<`SimilarityModel`<`TModel`, `TSelectModel`\>\>[]\>

#### Parameters

| Parameter | Type     | Default value |
| :-------- | :------- | :------------ |
| `query`   | `string` | `undefined`   |
| `k`       | `number` | `4`           |

#### Returns

`Promise`<[`Document`](../../document/classes/Document.md)<`SimilarityModel`<`TModel`, `TSelectModel`\>\>[]\>

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[similaritySearch](../../vectorstores_base/classes/VectorStore.md#similaritysearch)

#### Defined in

[langchain/src/vectorstores/prisma.ts:236](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/prisma.ts#L236)

### similaritySearchVectorWithScore()

> **similaritySearchVectorWithScore**(`query`: `number`[], `k`: `number`): `Promise`<[[`Document`](../../document/classes/Document.md)<`SimilarityModel`<`TModel`, `TSelectModel`\>\>, `number`][]\>

#### Parameters

| Parameter | Type       |
| :-------- | :--------- |
| `query`   | `number`[] |
| `k`       | `number`   |

#### Returns

`Promise`<[[`Document`](../../document/classes/Document.md)<`SimilarityModel`<`TModel`, `TSelectModel`\>\>, `number`][]\>

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[similaritySearchVectorWithScore](../../vectorstores_base/classes/VectorStore.md#similaritysearchvectorwithscore)

#### Defined in

[langchain/src/vectorstores/prisma.ts:248](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/prisma.ts#L248)

### similaritySearchWithScore()

> **similaritySearchWithScore**(`query`: `string`, `k`: `number` = `4`, `filter`: `undefined` \| `object` = `undefined`): `Promise`<[[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>, `number`][]\>

#### Parameters

| Parameter | Type                    | Default value |
| :-------- | :---------------------- | :------------ |
| `query`   | `string`                | `undefined`   |
| `k`       | `number`                | `4`           |
| `filter`  | `undefined` \| `object` | `undefined`   |

#### Returns

`Promise`<[[`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>, `number`][]\>

#### Inherited from

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[similaritySearchWithScore](../../vectorstores_base/classes/VectorStore.md#similaritysearchwithscore)

#### Defined in

[langchain/src/vectorstores/base.ts:76](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/base.ts#L76)

### fromDocuments()

> `Static` **fromDocuments**(`docs`: [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[], `embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `dbConfig`: `object`): `Promise`<`DefaultPrismaVectorStore`\>

#### Parameters

| Parameter                   | Type                                                                              |
| :-------------------------- | :-------------------------------------------------------------------------------- |
| `docs`                      | [`Document`](../../document/classes/Document.md)<`Record`<`string`, `any`\>\>[] |
| `embeddings`                | [`Embeddings`](../../embeddings_base/classes/Embeddings.md)                       |
| `dbConfig`                  | `object`                                                                          |
| `dbConfig.columns`          | `ModelColumns`<`Record`<`string`, `unknown`\>\>                                 |
| `dbConfig.db`               | `PrismaClient`                                                                    |
| `dbConfig.prisma`           | `PrismaNamespace`                                                                 |
| `dbConfig.tableName`        | `string`                                                                          |
| `dbConfig.vectorColumnName` | `string`                                                                          |

#### Returns

`Promise`<`DefaultPrismaVectorStore`\>

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[fromDocuments](../../vectorstores_base/classes/VectorStore.md#fromdocuments)

#### Defined in

[langchain/src/vectorstores/prisma.ts:304](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/prisma.ts#L304)

### fromTexts()

> `Static` **fromTexts**(`texts`: `string`[], `metadatas`: `object`[], `embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `dbConfig`: `object`): `Promise`<`DefaultPrismaVectorStore`\>

#### Parameters

| Parameter                   | Type                                                        |
| :-------------------------- | :---------------------------------------------------------- |
| `texts`                     | `string`[]                                                  |
| `metadatas`                 | `object`[]                                                  |
| `embeddings`                | [`Embeddings`](../../embeddings_base/classes/Embeddings.md) |
| `dbConfig`                  | `object`                                                    |
| `dbConfig.columns`          | `ModelColumns`<`Record`<`string`, `unknown`\>\>           |
| `dbConfig.db`               | `PrismaClient`                                              |
| `dbConfig.prisma`           | `PrismaNamespace`                                           |
| `dbConfig.tableName`        | `string`                                                    |
| `dbConfig.vectorColumnName` | `string`                                                    |

#### Returns

`Promise`<`DefaultPrismaVectorStore`\>

#### Overrides

[VectorStore](../../vectorstores_base/classes/VectorStore.md).[fromTexts](../../vectorstores_base/classes/VectorStore.md#fromtexts)

#### Defined in

[langchain/src/vectorstores/prisma.ts:279](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/prisma.ts#L279)

### withModel()

> `Static` **withModel**<TModel\>(`db`: `PrismaClient`): `object`

#### Type parameters

- `TModel` _extends_ `Record`<`string`, `unknown`\>

#### Parameters

| Parameter | Type           |
| :-------- | :------------- |
| `db`      | `PrismaClient` |

#### Returns

`object`

| Member          | Type                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| :-------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create`        | <TPrisma, TColumns\>(`embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `config`: \{`columns`: `TColumns`;<br />`prisma`: `TPrisma`;<br />`tableName`: _keyof_ `TPrisma`["ModelName"] & `string`;<br />`vectorColumnName`: `string`;}) => [`PrismaVectorStore`](PrismaVectorStore.md)<`TModel`, `ModelName`, `TColumns`\>                                                                                        |
| `fromDocuments` | <TPrisma, TColumns\>(`docs`: [`Document`](../../document/classes/Document.md)<`TModel`\>[], `embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `dbConfig`: \{`columns`: `TColumns`;<br />`prisma`: `TPrisma`;<br />`tableName`: _keyof_ `TPrisma`["ModelName"] & `string`;<br />`vectorColumnName`: `string`;}) => `Promise`<[`PrismaVectorStore`](PrismaVectorStore.md)<`TModel`, `ModelName`, `TColumns`\>\> |
| `fromTexts`     | <TPrisma, TColumns\>(`texts`: `string`[], `metadatas`: `TModel`[], `embeddings`: [`Embeddings`](../../embeddings_base/classes/Embeddings.md), `dbConfig`: \{`columns`: `TColumns`;<br />`prisma`: `TPrisma`;<br />`tableName`: _keyof_ `TPrisma`["ModelName"] & `string`;<br />`vectorColumnName`: `string`;}) => `Promise`<`DefaultPrismaVectorStore`\>                                                                                 |

#### Defined in

[langchain/src/vectorstores/prisma.ts:128](https://github.com/hwchase17/langchainjs/blob/ddf2996/langchain/src/vectorstores/prisma.ts#L128)
