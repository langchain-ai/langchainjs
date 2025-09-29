import { BufferMemory } from "langchain/memory";
import { FirestoreChatMessageHistory } from "@langchain/community/stores/message/firestore";
import { ChatOpenAI } from "@langchain/openai";
import { ConversationChain } from "langchain/chains";
import admin from "firebase-admin";

const memory = new BufferMemory({
  chatHistory: new FirestoreChatMessageHistory({
    collections: ["chats", "bots"],
    docs: ["chat-id", "bot-id"],
    sessionId: "user-id",
    userId: "a@example.com",
    config: {
      projectId: "YOUR-PROJECT-ID",
      credential: admin.credential.cert({
        projectId: "YOUR-PROJECT-ID",
        privateKey:
          "-----BEGIN PRIVATE KEY-----\nnCHANGE-ME\n-----END PRIVATE KEY-----\n",
        clientEmail: "CHANGE-ME@CHANGE-ME-TOO.iam.gserviceaccount.com",
      }),
    },
  }),
});

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
});
const chain = new ConversationChain({ llm: model, memory });

const res1 = await chain.invoke({ input: "Hi! I'm Jim." });
console.log({ res1 });
/*
{ res1: { response: 'Hello Jim! How can I assist you today?' } }
*/

const res2 = await chain.invoke({ input: "What did I just say my name was?" });
console.log({ res2 });

/*
{ res2: { response: 'You just said that your name is Jim.' } }
*/
