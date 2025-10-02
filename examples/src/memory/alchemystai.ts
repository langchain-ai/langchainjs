import { AlchemystMemory } from "@langchain/community/memory/alchemyst";
import { ChatOpenAI } from "@langchain/openai";
import { randomUUID } from "crypto";
import 'dotenv/config';
import { ConversationChain } from "langchain/chains";

async function main() {
  console.log("Boot: starting test with env:", {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? "set" : "missing",
    ALCHEMYST_AI_API_KEY: process.env.ALCHEMYST_AI_API_KEY ? "set" : "missing",
  });
  const sessionId = randomUUID();
  console.log("Session:", sessionId);

  const memory = new AlchemystMemory({
    apiKey: process.env.ALCHEMYST_AI_API_KEY || "YOUR_ALCHEMYST_API_KEY",
    sessionId,
  });

  const model = new ChatOpenAI({
    model: "gpt-5-nano",
    // temperature: 0,
  });

  const chain = new ConversationChain({ llm: model, memory });

  console.log("Invoke #1 ->");
  const first = await chain.invoke({ input: "Hi, my name is Anuran. Anuran is from Bangalore." });
  console.log("First reply:", first.response ?? first);

  console.log("Invoke #2 ->");
  const second = await chain.invoke({ input: "Who is Anuran? Where is Anuran from?" });
  console.log("Second reply:", second.response ?? second);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});