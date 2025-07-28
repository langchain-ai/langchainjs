import { BufferMemory } from "langchain/memory";
import { CassandraChatMessageHistory } from "@langchain/community/stores/message/cassandra";
import { ChatOpenAI } from "@langchain/openai";
import { ConversationChain } from "langchain/chains";

// The example below uses Astra DB, but you can use any Cassandra connection
const configConnection = {
  serviceProviderArgs: {
    astra: {
      token: "<your Astra Token>" as string,
      endpoint: "<your Astra Endpoint>" as string,
    },
  },
};

const memory = new BufferMemory({
  chatHistory: new CassandraChatMessageHistory({
    ...configConnection,
    keyspace: "langchain",
    table: "message_history",
    sessionId: "<some unique session identifier>",
  }),
});

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
});
const chain = new ConversationChain({ llm: model, memory });

const res1 = await chain.invoke({ input: "Hi! I'm Jonathan." });
console.log({ res1 });
/*
{
  res1: {
    text: "Hello Jonathan! How can I assist you today?"
  }
}
*/

const res2 = await chain.invoke({ input: "What did I just say my name was?" });
console.log({ res2 });

/*
{
  res1: {
    text: "You said your name was Jonathan."
  }
}
*/
