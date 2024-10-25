import { ChatOpenAI } from "@langchain/openai";
import { ConversationChain } from "langchain/chains";
import { BufferMemory } from "langchain/memory";
import {
  AzureCosmsosDBNoSQLChatMessageHistory,
  AzureCosmosDBNoSQLChatMessageHistoryInput,
} from "@langchain/azure-cosmosdb";

const input: AzureCosmosDBNoSQLChatMessageHistoryInput = {
  sessionId: "<unique-session-id>",
  userId: "user-id",
  databaseName: "DATABASE_NAME",
  containerName: "CONTAINER_NAME",
};
const memory = new BufferMemory({
  chatHistory: new AzureCosmsosDBNoSQLChatMessageHistory(input),
});

const model = new ChatOpenAI({
  model: "gpt-3.5-turbo",
  temperature: 0,
});

const chain = new ConversationChain({ llm: model, memory });

const res1 = await chain.invoke({ input: "Hi! I'm Jim." });
console.log({ res1 });
/*
    {
      res1: {
        response: "Hello Jim! It's nice to meet you. I am an AI language model designed to have conversations with humans. How can I assist you today?"
]       }
    }
  */

const res2 = await chain.invoke({ input: "What did I just say my name was?" });
console.log({ res2 });

/*
 { res2: { response: 'You said your name is Jim.' } 
  */

// See the chat history in the AzureCosmosDB
console.log(await memory.chatHistory.getMessages());

// clear chat history
await memory.chatHistory.clear();
