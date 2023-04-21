/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable tree-shaking/no-side-effects-in-initialization */
import { describe } from "@jest/globals";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { initializeAgentExecutorWithOptions } from "../initialize.js";
import { OpenAI } from "../../index.js";
import { Tool } from "../../tools/base.js";
import { SerpAPI } from "../../tools/serpapi.js";
import { Calculator } from "../../tools/calculator.js";
import { RequestsGetTool, RequestsPostTool } from "../../tools/requests.js";
// import { AIPluginTool } from "../../tools/aiplugin.js";

const agents = [
  (tools) =>
    initializeAgentExecutorWithOptions(
      tools,
      new ChatOpenAI({ temperature: 0 }),
      { agentType: "chat-zero-shot-react-description" }
    ),
  (tools) =>
    initializeAgentExecutorWithOptions(
      tools,
      new ChatOpenAI({ temperature: 0 }),
      { agentType: "chat-conversational-react-description" }
    ),
  (tools) =>
    initializeAgentExecutorWithOptions(tools, new OpenAI({ temperature: 0 }), {
      agentType: "zero-shot-react-description",
    }),
] as ((
  tools: Tool[]
) => ReturnType<typeof initializeAgentExecutorWithOptions>)[];

const scenarios = [
  {
    tools: [
      new RequestsGetTool(),
      new RequestsPostTool(),
      // await AIPluginTool.fromPluginUrl(
      //   "https://www.klarna.com/.well-known/ai-plugin.json"
      // ),
    ],
    input: "what t shirts are available in klarna?",
  },
  {
    tools: [
      new SerpAPI(undefined, {
        location: "Austin,Texas,United States",
        hl: "en",
        gl: "us",
      }),
      new Calculator(),
    ],
    input: `Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?`,
  },
] as { tools: Tool[]; input: string }[];

describe.each(agents)(
  `Run agent with %p`,
  async (initializeAgentExecutorWithTools) => {
    test.each(scenarios)(`Run agent with %p`, async ({ tools, input }) => {
      const agent = await initializeAgentExecutorWithTools(tools);
      const result = await agent.call({ input });
      console.log({ result });
    });
  }
);
