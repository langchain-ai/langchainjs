import { ZepCloudRetriever } from "@langchain/community/retrievers/zep_cloud";
import { randomUUID } from "crypto";
import { ZepClient, type Zep } from "@getzep/zep-cloud";

function sleep(ms: number) {
  // eslint-disable-next-line no-promise-executor-return
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const zepConfig = {
  // Your Zep Cloud Project API key https://help.getzep.com/projects
  apiKey: "<Zep Api Key>",
  sessionId: `session_${randomUUID()}`,
};

console.log(`Zep Config: ${JSON.stringify(zepConfig)}`);

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

const zepClient = new ZepClient({
  apiKey: zepConfig.apiKey,
});

// Add chat messages to memory
for (const chatMessage of chatMessages) {
  let m: Zep.Message;
  if (chatMessage.role === "AI") {
    m = { role: "ai", roleType: "assistant", content: chatMessage.message };
  } else {
    m = { role: "human", roleType: "user", content: chatMessage.message };
  }

  await zepClient.memory.add(zepConfig.sessionId, { messages: [m] });
}

// Wait for messages to be summarized, enriched, embedded and indexed.
await sleep(10000);

// Simple similarity search
const query = "Can I drive red cars in France?";
const retriever = new ZepCloudRetriever({ ...zepConfig, topK: 3 });
const docs = await retriever.invoke(query);
console.log("Simple similarity search");
console.log(JSON.stringify(docs, null, 2));

// mmr reranking search
const mmrRetriever = new ZepCloudRetriever({
  ...zepConfig,
  topK: 3,
  searchType: "mmr",
  mmrLambda: 0.5,
});
const mmrDocs = await mmrRetriever.invoke(query);
console.log("MMR reranking search");
console.log(JSON.stringify(mmrDocs, null, 2));

// summary search with mmr reranking
const mmrSummaryRetriever = new ZepCloudRetriever({
  ...zepConfig,
  topK: 3,
  searchScope: "summary",
  searchType: "mmr",
  mmrLambda: 0.5,
});
const mmrSummaryDocs = await mmrSummaryRetriever.invoke(query);
console.log("Summary search with MMR reranking");
console.log(JSON.stringify(mmrSummaryDocs, null, 2));

// Filtered search
const filteredRetriever = new ZepCloudRetriever({
  ...zepConfig,
  topK: 3,
  filter: {
    where: { jsonpath: '$[*] ? (@.foo == "bar")' },
  },
});
const filteredDocs = await filteredRetriever.invoke(query);
console.log("Filtered search");
console.log(JSON.stringify(filteredDocs, null, 2));
