import {
  CacheClient,
  Configurations,
  CredentialProvider,
} from "@gomomento/sdk"; // `from "gomomento/sdk-web";` for browser/edge
import { BufferMemory } from "langchain/memory";
import { ChatOpenAI } from "@langchain/openai";
import { ConversationChain } from "langchain/chains";
import { MomentoChatMessageHistory } from "@langchain/community/stores/message/momento";

// See https://github.com/momentohq/client-sdk-javascript for connection options
const client = new CacheClient({
  configuration: Configurations.Laptop.v1(),
  credentialProvider: CredentialProvider.fromEnvironmentVariable({
    environmentVariableName: "MOMENTO_API_KEY",
  }),
  defaultTtlSeconds: 60 * 60 * 24,
});

// Create a unique session ID
const sessionId = new Date().toISOString();
const cacheName = "langchain";

const memory = new BufferMemory({
  chatHistory: await MomentoChatMessageHistory.fromProps({
    client,
    cacheName,
    sessionId,
    sessionTtl: 300,
  }),
});
console.log(
  `cacheName=${cacheName} and sessionId=${sessionId} . This will be used to store the chat history. You can inspect the values at your Momento console at https://console.gomomento.com.`
);

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
    text: "Hello Jim! It's nice to meet you. My name is AI. How may I assist you today?"
  }
}
*/

const res2 = await chain.invoke({ input: "What did I just say my name was?" });
console.log({ res2 });

/*
{
  res1: {
    text: "You said your name was Jim."
  }
}
*/

// See the chat history in the Momento
console.log(await memory.chatHistory.getMessages());
