import { AzureCosmosDBNoSQLConfig, AzureCosmosDBNoSQLSemanticCache } from "@langchain/azure-cosmosdb";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";


const embeddings = new OpenAIEmbeddings();
const config: AzureCosmosDBNoSQLConfig = {
    databaseName: "<DATABASE_NAME>",
    containerName: "<CONTAINER_NAME>",
    // use endpoint to initiate client with managed identity
    connectionString: "<CONNECTION_STRING>",
}
const cache = new AzureCosmosDBNoSQLSemanticCache(embeddings, config);

const model = new ChatOpenAI({ cache });

// Invoke the model to perform an action
const response1 = await model.invoke("Do something random!");
console.log(response1);
/*
  AIMessage {
    content: "Sure! I'll generate a random number for you: 37",
    additional_kwargs: {}
  }
*/

const response2 = await model.invoke("Do something random!");
console.log(response2);
/*
  AIMessage {
    content: "Sure! I'll generate a random number for you: 37",
    additional_kwargs: {}
  }
*/

