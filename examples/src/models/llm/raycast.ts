import { RaycastAI } from "langchain/llms/raycast";

import { showHUD } from "@raycast/api";
import { Tool } from "langchain/tools";
import { initializeAgentExecutorWithOptions } from "langchain/agents";

const model = new RaycastAI({
  rateLimitPerMinute: 10, // It is 10 by default so you can omit this line
  model: "gpt-3.5-turbo",
  creativity: 0, // `creativity` is a term used by Raycast which is equivalent to `temperature` in some other LLMs
});

const tools: Tool[] = [
  // Add your tools here
];

export default async function main() {
  // Initialize the agent executor with RaycastAI model
  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "chat-conversational-react-description",
  });

  const input = `Describe my today's schedule as Gabriel Garcia Marquez would describe it`;

  const answer = await executor.invoke({ input });

  await showHUD(answer.output);
}
