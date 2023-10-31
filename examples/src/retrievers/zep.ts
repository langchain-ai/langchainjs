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

  // Generate chat messages about traveling to France
  const chatMessages = [
    {
      role: "AI",
      message: "Bonjour! How can I assist you with your travel plans today?",
    },
    { role: "User", message: "I'm planning a trip to France." },
    {
      role: "AI",
      message: "That sounds exciting! What cities are you planning to visit?",
    },
    { role: "User", message: "I'm thinking of visiting Paris and Nice." },
    {
      role: "AI",
      message: "Great choices! Are you interested in any specific activities?",
    },
    { role: "User", message: "I would love to visit some vineyards." },
    {
      role: "AI",
      message:
        "France has some of the best vineyards in the world. I can help you find some.",
    },
    { role: "User", message: "That would be great!" },
    { role: "AI", message: "Do you prefer red or white wine?" },
    { role: "User", message: "I prefer red wine." },
    {
      role: "AI",
      message:
        "Perfect! I'll find some vineyards that are known for their red wines.",
    },
    { role: "User", message: "Thank you, that would be very helpful." },
    {
      role: "AI",
      message:
        "You're welcome! I'll also look up some French wine etiquette for you.",
    },
    {
      role: "User",
      message: "That sounds great. I can't wait to start my trip!",
    },
    {
      role: "AI",
      message:
        "I'm sure you'll have a fantastic time. Do you have any other questions about your trip?",
    },
    { role: "User", message: "Not at the moment, thank you for your help!" },
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

  // Wait for messages to be summarized, enriched, embedded and indexed.
  await sleep(10000);

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

  // summary search with mmr reranking
  const mmrSummaryRetriever = new ZepRetriever({
    ...zepConfig,
    topK: 3,
    searchScope: "summary",
    searchType: "mmr",
    mmrLambda: 0.5,
  });
  const mmrSummaryDocs = await mmrSummaryRetriever.getRelevantDocuments(query);
  console.log("Summary search with MMR reranking");
  console.log(JSON.stringify(mmrSummaryDocs, null, 2));

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
