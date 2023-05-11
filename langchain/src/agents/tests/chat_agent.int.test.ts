/* eslint-disable no-process-env */
import { expect, test } from "@jest/globals";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { SerpAPI } from "../../tools/serpapi.js";
import { Calculator } from "../../tools/calculator.js";
import { initializeAgentExecutorWithOptions } from "../initialize.js";
import { HumanChatMessage } from "../../schema/index.js";
import { RequestsGetTool, RequestsPostTool } from "../../tools/requests.js";
import { AIPluginTool } from "../../tools/aiplugin.js";

test("Run agent locally", async () => {
  const model = new ChatOpenAI({ temperature: 0 });
  const tools = [
    new SerpAPI(undefined, {
      location: "Austin,Texas,United States",
      hl: "en",
      gl: "us",
    }),
    new Calculator(),
  ];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "chat-zero-shot-react-description",
  });

  const input = `Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?`;
  console.log(`Executing with input "${input}"...`);

  const result = await executor.call({ input });

  console.log(`Got output ${result.output}`);
});

test("Run chat agent locally with an abort signal", async () => {
  const model = new ChatOpenAI({ temperature: 0 });
  const tools = [new Calculator()];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "chat-zero-shot-react-description",
  });
  console.log("Loaded agent.");

  const input = `What is 3 to the fourth power?`;
  console.log(`Executing with input "${input}"...`);

  const controller = new AbortController();
  await expect(() => {
    const result = executor.call({ input, signal: controller.signal });
    controller.abort();
    return result;
  }).rejects.toThrow();
});

test("Run agent with klarna and requests tools", async () => {
  const tools = [
    new RequestsGetTool(),
    new RequestsPostTool(),
    await AIPluginTool.fromPluginUrl(
      "https://www.klarna.com/.well-known/ai-plugin.json"
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
});

test("Run agent with incorrect api key should throw error", async () => {
  const model = new ChatOpenAI({
    temperature: 0,
    openAIApiKey: "invalid",
    maxRetries: 0,
  });
  const tools = [
    new SerpAPI(undefined, {
      location: "Austin,Texas,United States",
      hl: "en",
      gl: "us",
    }),
    new Calculator(),
  ];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "chat-zero-shot-react-description",
  });

  const input = `Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?`;

  // Test that the model throws an error
  await expect(() =>
    model.call([new HumanChatMessage(input)])
  ).rejects.toThrowError("Request failed with status code 401");

  // Test that the agent throws the same error
  await expect(() => executor.call({ input })).rejects.toThrowError(
    "Request failed with status code 401"
  );
});
