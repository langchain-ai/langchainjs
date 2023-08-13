import { ZepRetriever } from "langchain/retrievers/zep";
import { ZepMemory } from "langchain/memory/zep";
import { Memory as MemoryModel, Message } from "@getzep/zep-js";
import { randomUUID } from "crypto";

function sleep(ms: number) {
  // eslint-disable-next-line no-promise-executor-return
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const run = async () => {
  const zepConfig = {
    url: process.env.ZEP_URL || "http://localhost:8000",
    sessionId: `session_${randomUUID()}`,
  };

  console.log(`Zep Config: ${JSON.stringify(zepConfig)}`);

  const memory = new ZepMemory({
    baseURL: zepConfig.url,
    sessionId: zepConfig.sessionId,
  });

  // Generate chat messages
  const chatMessages = [
    { role: "AI", message: "Hello, I'm AI. How can I help you today?" },
    { role: "User", message: "I'm looking for a new car." },
    { role: "AI", message: "Great! What kind of car are you looking for?" },
    { role: "User", message: "I'm looking for a red car." },
    { role: "AI", message: "We have many red cars. Anything more specific?" },
    { role: "User", message: "I'm looking for a red car with a sunroof." },
  ];

  const zepClient = await memory.zepClientPromise;
  if (!zepClient) {
    throw new Error("ZepClient is not initialized");
  }

  // Add chat messages to memory
  for (const chatMessage of chatMessages) {
    let m: MemoryModel;
    if (chatMessage.role === "AI") {
      m = new MemoryModel({
        messages: [new Message({ role: "ai", content: chatMessage.message })],
      });
    } else {
      m = new MemoryModel({
        messages: [
          new Message({ role: "human", content: chatMessage.message }),
        ],
      });
    }

    await zepClient.memory.addMemory(zepConfig.sessionId, m);
  }

  await sleep(2000);

  const query = "What type of car did the user ask for?";
  const retriever = new ZepRetriever(zepConfig);
  const docs = await retriever.getRelevantDocuments(query);

  console.log(docs);
};
