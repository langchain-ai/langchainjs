import { AlchemystMemory } from "@langchain/community/memory/alchemystai";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnablePassthrough, RunnableSequence } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { randomUUID } from "crypto";
import 'dotenv/config';

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
  });

  // Create a prompt template with message history
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful AI assistant. Have a conversation with the human, using the chat history for context."],
    new MessagesPlaceholder("history"),
    ["human", "{input}"],
  ]);

  // Create the chain using LCEL (LangChain Expression Language)
  const chain = RunnableSequence.from([
    RunnablePassthrough.assign({
      history: async () => {
        const memoryVars = await memory.loadMemoryVariables({});
        return memoryVars.history || [];
      },
    }),
    prompt,
    model,
  ]);

  console.log("Invoke #1 ->");
  const first = await chain.invoke({ input: "Hi, my name is Anuran. Anuran is from Bangalore." });

  // Save to memory
  await memory.saveContext(
    { input: "Hi, my name is Anuran. Anuran is from Bangalore." },
    { output: first.content }
  );

  console.log("First reply:", first.content);

  console.log("Invoke #2 ->");
  const second = await chain.invoke({ input: "Who is Anuran? Where is Anuran from?" });

  // Save to memory
  await memory.saveContext(
    { input: "Who is Anuran? Where is Anuran from?" },
    { output: second.content }
  );

  console.log("Second reply:", second.content);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});