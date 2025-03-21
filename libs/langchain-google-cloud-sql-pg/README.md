# @langchain/google-cloud-sql-pg

The LangChain package for CloudSQL for Postgres provides a way to connect to Cloud SQL instances from the LangChain ecosystem.


Main features:
* The package creates a shared connection pool to connect to Google Cloud Postgres databases utilizing different ways for authentication such as IAM, user and password authorization.
* Store metadata in columns instead of JSON, resulting in significant performance improvements.

##  Before you begin

In order to use this package, you first need to go through the following steps:
1.  [Select or create a Cloud Platform project.](https://console.cloud.google.com/project)
2.  [Enable billing for your project.](https://cloud.google.com/billing/docs/how-to/modify-project#enable_billing_for_a_project)
3.  [Enable the Cloud SQL Admin API.](https://cloud.google.com/sql/docs/postgres/admin-api)
4.  [Setup Authentication.](https://cloud.google.com/docs/authentication)

### Installation

```bash
$ yarn add @langchain/google-cloud-sql-pg
```

## Example usage

### PostgresEngine usage

Before you use the PostgresVectorStore you will need to create a postgres connection through the PostgresEngine interface.

```javascript
import { Column, PostgresEngine, PostgresEngineArgs, PostgresVectorStore, VectorStoreTableArgs } from "@langchain/google-cloud-sql-pg";
import { SyntheticEmbeddings } from "@langchain/core/utils/testing";

const pgArgs: PostgresEngineArgs = {
    user: "db-user",
    password: "password"
}

const engine: PostgresEngine = await PostgresEngine.fromInstance(
 "project-id",
 "region",
 "instance-name",
 "database-name",
 pgArgs
);

const vectorStoreTableArgs: VectorStoreTableArgs = {
  metadataColumns: [new Column("page", "TEXT"), new Column("source", "TEXT")],
};

await engine.initVectorstoreTable("my-table", 768, vectorStoreTableArgs);
const embeddingService = new SyntheticEmbeddings({ vectorSize: 768 });

```

-   You can pass the ipType, user, password and iamAccountEmail through the PostgresEngineArgs interface to the PostgresEngine creation.
-   You can pass the schemaName, contentColumn, embeddingColum, metadataColumns and others through the VectorStoreTableArgs interface to the init_vectorstore_table method.
-   Passing an empty object to these methods allows you to use the default values.

### Vector Store usage

Use a PostgresVectorStore to store embedded data and perform vector similarity search for Postgres.

```javascript
const pvectorArgs: PostgresVectorStoreArgs = {
    idColumn: "ID_COLUMN",
    contentColumn: "CONTENT_COLUMN",
    embeddingColumn: "EMBEDDING_COLUMN",
    metadataColumns: ["page", "source"]
}

const vectorStoreInstance = await PostgresVectorStore.initialize(engine, embeddingService, "my-table", pvectorArgs)
```
-   You can pass the schemaName, contentColumn, embeddingColumn, distanceStrategy and others through the PostgresVectorStoreArgs interface to the PostgresVectorStore creation.
-   Passing an empty object to these methods allows you to use the default values.

PostgresVectorStore interface methods available:

-   addDocuments
-   addVectors
-   similaritySearch
-   and others.

See the full [Vector Store](https://js.langchain.com/docs/integrations/vectorstores/google_cloudsql_pg) tutorial.

### Chat Message History usage

Use `PostgresChatMessageHistory` to store messages and provide conversation history in Postgres.

First, initialize the Chat History Table and then create the ChatMessageHistory instance.

```javascript
// ChatHistory table initialization
await engine.initChatHistoryTable("chat_message_table");

const historyInstance = await PostgresChatMessageHistory.initialize(engine, "test", "chat_message_table");
```

The create method of the PostgresChatMessageHistory receives the engine, the session Id and the table name.

PostgresChatMessageHistory interface methods available:

-   addMessage
-   addMessages
-   getMessages
-   clear

See the full [Chat Message History](https://js.langchain.com/docs/integrations/memory/google_cloudsql_pg) tutorial.

### Document Loader usage

Use a document loader to load data as LangChain `Document`s.

```typescript
import { PostgresEngine, PostgresLoader } from "@langchain/google-cloud-sql-pg";

const documentLoaderArgs: PostgresLoaderOptions = {
  tableName: "test_table_custom",
  contentColumns: [ "fruit_name", "variety"],
  metadataColumns: ["fruit_id", "quantity_in_stock", "price_per_unit", "organic"],
  format: "text"
};

const documentLoaderInstance = await PostgresLoader.initialize(PEInstance, documentLoaderArgs);

const documents = await documentLoaderInstance.load();
```

See the full [Loader](https://js.langchain.com/docs/integrations/document_loaders/web_loaders/google_cloudsql_pg) tutorial.