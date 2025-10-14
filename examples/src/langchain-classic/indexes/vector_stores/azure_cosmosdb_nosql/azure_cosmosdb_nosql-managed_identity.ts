import { AzureCosmosDBNoSQLVectorStore } from "@langchain/azure-cosmosdb";
import { OpenAIEmbeddings } from "@langchain/openai";

// Create Azure Cosmos DB vector store
const store = new AzureCosmosDBNoSQLVectorStore(new OpenAIEmbeddings(), {
  // Or use environment variable AZURE_COSMOSDB_NOSQL_ENDPOINT
  endpoint: "https://my-cosmosdb.documents.azure.com:443/",

  // Database and container must already exist
  databaseName: "my-database",
  containerName: "my-container",
});
