import { BufferMemory } from "langchain/memory";
import { CassandraChatMessageHistory } from "langchain/stores/message/cassandra";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { ConversationChain } from "langchain/chains";

const memory = new BufferMemory({
  chatHistory: new CassandraChatMessageHistory({
    cloud: {
      secureConnectBundle: "<path to your secure bundle>",
    },
    credentials: {
      username: "token",
      password: "<your Cassandra access token>",
    },
    keyspace: "langchain",
    table: "message_history",
    sessionId: "<some unique session identifier>",
  }),
});

const model = new ChatOpenAI();
const chain = new ConversationChain({ llm: model, memory });

const res1 = await chain.call({ input: "Hi! I'm Jonathan." });
console.log({ res1 });
/*
{
  res1: {
    text: "Hello Jonathan! How can I assist you today?"
  }
}
*/

const res2 = await chain.call({ input: "What did I just say my name was?" });
console.log({ res2 });

/*
{
  res1: {
    text: "You said your name was Jonathan."
  }
}
*/
