import { ChatOpenAI } from "langchain/chat_models/openai";
import { initializeAgentExecutor } from "langchain/agents";
import {
  RequestsGetTool,
  RequestsPostTool,
  AIPluginTool,
} from "langchain/tools";

export const run = async () => {
  const tools = [
    new RequestsGetTool(),
    new RequestsPostTool(),
    await AIPluginTool.fromPluginUrl(
      "https://www.klarna.com/.well-known/ai-plugin.json"
    ),
  ];
  const agent = await initializeAgentExecutor(
    tools,
    new ChatOpenAI({ temperature: 0 }),
    "chat-zero-shot-react-description",
    true
  );

  const result = await agent.call({
    input: "what t shirts are available in klarna?",
  });

  console.log({ result });
};
