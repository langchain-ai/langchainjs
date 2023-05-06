import { BufferMemory } from "langchain/memory";
import { DynamoDBChatMessageHistory } from "langchain/stores/message/dynamodb";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { ConversationChain } from "langchain/chains";

const memory = new BufferMemory({
  chatHistory: new DynamoDBChatMessageHistory({
    tableName: "langchain",
    partitionKey: "id",
    sessionId: new Date().toISOString(), // Or some other unique identifier for the conversation
    config: {
      region: "us-east-2",
      credentials: {
        accessKeyId: "<your AWS access key id>",
        secretAccessKey: "<your AWS secret access key>",
      },
    },
  }),
});

const model = new ChatOpenAI();
const chain = new ConversationChain({ llm: model, memory });

const res1 = await chain.call({ input: "Hi! I'm Jim." });
console.log({ res1 });
/*
{
  res1: {
    text: "Hello Jim! It's nice to meet you. My name is AI. How may I assist you today?"
  }
}
*/

const res2 = await chain.call({ input: "What did I just say my name was?" });
console.log({ res2 });

/*
{
  res1: {
    text: "You said your name was Jim."
  }
}
*/
