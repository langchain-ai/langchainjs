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
    {
      role: "User",
      message:
        "I'm looking for a red car with a sunroof that I can drive to Paris.",
    },
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

  await sleep(5000);

  // Simple similarity search
  const query = "Can I drive red cars in France?";
  const retriever = new ZepRetriever({ ...zepConfig, topK: 3 });
  const docs = await retriever.getRelevantDocuments(query);
  console.log("Simple similarity search");
  console.log(JSON.stringify(docs, null, 2));

  // mmr reranking search
  const mmrRetriever = new ZepRetriever({
    ...zepConfig,
    topK: 3,
    searchType: "mmr",
    mmrLambda: 0.5,
  });
  const mmrDocs = await mmrRetriever.getRelevantDocuments(query);
  console.log("MMR reranking search");
  console.log(JSON.stringify(mmrDocs, null, 2));

  // Filtered search
  const filteredRetriever = new ZepRetriever({
    ...zepConfig,
    topK: 3,
    filter: {
      where: { jsonpath: '$.system.entities[*] ? (@.Label == "GPE")' },
    },
  });
  const filteredDocs = await filteredRetriever.getRelevantDocuments(query);
  console.log("Filtered search");
  console.log(JSON.stringify(filteredDocs, null, 2));
};
