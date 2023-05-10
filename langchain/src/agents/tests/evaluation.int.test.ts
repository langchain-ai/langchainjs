/* eslint-disable @typescript-eslint/no-misused-promises */
import { describe } from "@jest/globals";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { initializeAgentExecutorWithOptions } from "../initialize.js";
import { OpenAI } from "../../llms/openai.js";
import { Tool } from "../../tools/base.js";
import { SerpAPI } from "../../tools/serpapi.js";
import { Calculator } from "../../tools/calculator.js";
import { RequestsGetTool, RequestsPostTool } from "../../tools/requests.js";
import { AIPluginTool } from "../../tools/aiplugin.js";

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
  async () => ({
    tools: [
      new RequestsGetTool(),
      new RequestsPostTool(),
      await AIPluginTool.fromPluginUrl(
        "https://www.klarna.com/.well-known/ai-plugin.json"
      ),
    ],
    input: "what t shirts are available in klarna?",
  }),
  async () => ({
    tools: [
      new SerpAPI(undefined, {
        location: "Austin,Texas,United States",
        hl: "en",
        gl: "us",
      }),
      new Calculator(),
    ],
    input: `how is your day going?`,
  }),
  async () => ({
    tools: [
      new SerpAPI(undefined, {
        location: "Austin,Texas,United States",
        hl: "en",
        gl: "us",
      }),
      new Calculator(),
    ],
    input: `whats is 9 to the 2nd power?`,
  }),
] as (() => Promise<{ tools: Tool[]; input: string }>)[];

describe.each(agents)(`Run agent %#`, (initializeAgentExecutorWithTools) => {
  test.concurrent.each(scenarios)(`With scenario %#`, async (scenario) => {
    const agentIndex = agents.indexOf(initializeAgentExecutorWithTools);
    const scenarioIndex = scenarios.indexOf(scenario);
    const { tools, input } = await scenario();
    const agent = await initializeAgentExecutorWithTools(tools);
    const result = await agent.call({ input });
    console.log(`Agent #${agentIndex}`, `Scenario #${scenarioIndex}`, {
      result,
    });
    expect(typeof result.output).toBe("string");
  });
});
