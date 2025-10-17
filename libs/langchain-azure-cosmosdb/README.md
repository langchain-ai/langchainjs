# @langchain/azure-cosmosdb

This package contains the [Azure CosmosDB](https://learn.microsoft.com/azure/cosmos-db/) vector store integrations.

Learn more about how to use this package in the LangChain documentation:

- [Azure CosmosDB for NoSQL](https://js.langchain.com/docs/integrations/vector_stores/azure_cosmosdb_nosql)
- [Azure CosmosDB for MongoDB vCore](https://js.langchain.com/docs/integrations/vector_stores/azure_cosmosdb_mongodb)

## Installation

```bash npm2yarn
npm install @langchain/azure-cosmosdb @langchain/core
```

This package, along with the main LangChain package, depends on [`@langchain/core`](https://npmjs.com/package/@langchain/core/).
If you are using this package with other LangChain packages, you should make sure that all of the packages depend on the same instance of @langchain/core.
You can do so by adding appropriate fields to your project's `package.json` like this:

```json
{
  "name": "your-project",
  "version": "0.0.0",
  "dependencies": {
    "@langchain/core": "^0.3.0",
    "@langchain/azure-cosmosdb": "^0.2.5"
  },
  "resolutions": {
    "@langchain/core": "0.3.0"
  },
  "overrides": {
    "@langchain/core": "0.3.0"
  },
  "pnpm": {
    "overrides": {
      "@langchain/core": "0.3.0"
    }
  }
}
```

The field you need depends on the package manager you're using, but we recommend adding a field for the common `yarn`, `npm`, and `pnpm` to maximize compatibility.

## Usage

```typescript
import { AzureCosmosDBNoSQLVectorStore } from "@langchain/azure-cosmosdb";

const store = await AzureCosmosDBNoSQLVectorStore.fromDocuments(
  ["Hello, World!"],
  new OpenAIEmbeddings(),
  {
    databaseName: "langchain",
    containerName: "documents",
  }
);

const resultDocuments = await store.similaritySearch("hello");
console.log(resultDocuments[0].pageContent);
```
