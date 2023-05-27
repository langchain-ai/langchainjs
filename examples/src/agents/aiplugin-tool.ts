import { ChatOpenAI } from "langchain/chat_models/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";

import {
  HttpRequestTool,
  AIPluginTool,
} from "langchain/tools";

export const run = async () => {
  const model = new ChatOpenAI({ temperature: 0 });
  const tools = [
    new HttpRequestTool(),
    await AIPluginTool.fromPluginUrl(
      "https://www.klarna.com/.well-known/ai-plugin.json", model
    ),
  ];
  const agent = await initializeAgentExecutorWithOptions(
    tools,
    model,
    { agentType: "chat-zero-shot-react-description", verbose: true }
  );

  const result = await agent.call({
    input: "what t shirts are available in klarna?",
  });

  console.log({ result });
};
