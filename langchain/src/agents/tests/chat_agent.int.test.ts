/* eslint-disable no-process-env */
import { expect, test } from "@jest/globals";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { SerpAPI } from "../../tools/serpapi.js";
import { Calculator } from "../../tools/calculator.js";
import { initializeAgentExecutorWithOptions } from "../initialize.js";
import { HumanMessage } from "../../schema/index.js";

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

  let error;
  // Test that the model throws an error
  await expect(async () => {
    try {
      await model.call([new HumanMessage(input)]);
    } catch (e) {
      error = e;
      throw e;
    }
  }).rejects.toThrowError();

  // Test that the agent throws the same error
  await expect(() => executor.call({ input })).rejects.toThrowError(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (error as any)?.message
  );
});
