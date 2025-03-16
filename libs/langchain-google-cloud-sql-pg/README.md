# @langchain/google-cloud-sql-pg

The LangChain package for CloudSQL for Postgres provides a way to connect to Cloud SQL instances from the LangChain ecosystem.


Main features:
* The package creates a shared connection pool to connect to Google Cloud Postgress databases utilizing different ways for authentication such as IAM, user and password authorization.
* Store metadata in columns instead of JSON, resulting in significant performance improvements.

##  Before you begin

In order to use this package, you first need to go throught the following steps:
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

### VectorStore usage

Use a PostgresVectorStore to store embedded data and perform vector similarity search for Postgres.

```javascript
const pvectorArgs: PostgresVectorStoreArgs = {
    idColumn: "ID_COLUMN",
    contentColumn: "CONTENT_COLUMN",
    embeddingColumn: "EMBEDDING_COLUMN",
    metadataColumns: ["page", "source"]
}

const vectorStoreInstance = await PostgresVectorStore.create(engine, embeddingService, "my-table", pvectorArgs)
```
-   You can pass the schemaName, contentColumn, embeddingColumn, distanceStrategy and others through the PostgresVectorStoreArgs interface to the PostgresVectorStore creation.
-   Passing an empty object to these methods allows you to use the default values.

PostgresVectorStore interface methods availables:

-   addDocuments
-   addVectors
-   similaritySearch
-   and others.

See the full [Vector Store](https://js.langchain.com/docs/integrations/vectorstores/google_cloudsql_pg) tutorial.

<!-- TODO: ### Document Loader usage -->

<!-- TODO: ### ChatMessageHistory usage -->
