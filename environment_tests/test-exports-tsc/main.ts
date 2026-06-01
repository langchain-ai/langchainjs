import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createAgent } from "langchain";

const model = new ChatOpenAI({
  openAIApiKey: "sk-XXXX",
});

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant"],
  ["placeholder", "{chat_history}"],
  ["human", "{input}"],
  ["placeholder", "{agent_scratchpad}"],
]);

// Regression for #10888: this package's tsconfig disables strictNullChecks.
export async function invokeAgentWithMessages() {
  const agent = createAgent({
    model: "openai:gpt-4o-mini",
    tools: [],
    systemPrompt: "You are a helpful assistant.",
  });

  await agent.invoke({
    messages: [
      {
        role: "human",
        content: "Please generate a greeting message.",
      },
    ],
  });
}
