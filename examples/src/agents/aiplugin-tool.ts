import { ChatOpenAI } from "langchain/chat_models/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import {
  HttpRequestTool,
  AIPluginTool,
} from "langchain/tools";

export const run = async () => {
  const tools = [
    new HttpRequestTool(),
    await AIPluginTool.fromPluginUrl(
      "https://www.klarna.com/.well-known/ai-plugin.json", new ChatOpenAI({ temperature: 0 })
    ),
  ];
  const agent = await initializeAgentExecutorWithOptions(
    tools,
    new ChatOpenAI({ temperature: 0 }),
    { agentType: "chat-zero-shot-react-description", verbose: true }
  );

  const result = await agent.call({
    input: "what t shirts are available in klarna?",
  });

  console.log({ result });
};
