/* eslint-disable no-process-env */
import * as uuid from "uuid";
import { test } from "@jest/globals";

import { LangChainTracer } from "../handlers/tracer_langchain.js";
import { OpenAI } from "../../llms/openai.js";
import { SerpAPI } from "../../tools/serpapi.js";
import { Calculator } from "../../tools/calculator.js";
import { initializeAgentExecutorWithOptions } from "../../agents/initialize.js";
import { HumanChatMessage } from "../../schema/index.js";
import { ChatOpenAI } from "../../chat_models/openai.js";

test("Test LangChain V2 tracer", async () => {
  const tracer = new LangChainTracer({
    sessionName: `JS Int Test - ${uuid.v4()}`,
    sessionExtra: { source: "langchain-js" },
  });
  const chainRunId = uuid.v4();
  const toolRunId = uuid.v4();
  const llmRunId = uuid.v4();
  const chatRunId = uuid.v4();
  await tracer.handleChainStart({ name: "test" }, { foo: "bar" }, chainRunId);
  await tracer.handleToolStart({ name: "test" }, "test", toolRunId, chainRunId);
  await tracer.handleLLMStart({ name: "test" }, ["test"], llmRunId, toolRunId);
  await tracer.handleLLMEnd({ generations: [[]] }, llmRunId);
  await tracer.handleChatModelStart(
    { name: "testChatModel" },
    [[new HumanChatMessage("I'm a human.")]],
    chatRunId
  );
  await tracer.handleLLMEnd({ generations: [[]] }, chatRunId);
  await tracer.handleToolEnd("output", toolRunId);
  const llmRunId2 = uuid.v4();
  await tracer.handleLLMStart(
    { name: "test2" },
    ["test"],
    llmRunId2,
    chainRunId
  );
  await tracer.handleLLMEnd({ generations: [[]] }, llmRunId2);
  await tracer.handleChainEnd({ foo: "bar" }, chainRunId);

  const llmRunId3 = uuid.v4();
  await tracer.handleLLMStart({ name: "test" }, ["test"], llmRunId3);
  await tracer.handleLLMEnd({ generations: [[]] }, llmRunId3);
});

test("Test Traced Agent with concurrency", async () => {
  process.env.LANGCHAIN_TRACING_V2 = "true";
  const model = new OpenAI({ temperature: 0 });
  const tools = [
    new SerpAPI(process.env.SERPAPI_API_KEY, {
      location: "Austin,Texas,United States",
      hl: "en",
      gl: "us",
    }),
    new Calculator(),
  ];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "zero-shot-react-description",
    verbose: true,
  });

  const input = `What is 24,678,987 raised to the 0.23 power?`;

  console.log(`Executing with input "${input}"...`);

  const [resultA, resultB, resultC] = await Promise.all([
    executor.call({ input }),
    executor.call({ input }),
    executor.call({ input }),
  ]);

  console.log(`Got output ${resultA.output}`);
  console.log(`Got output ${resultB.output}`);
  console.log(`Got output ${resultC.output}`);
});

test("Test Traced Agent with chat model", async () => {
  process.env.LANGCHAIN_TRACING_V2 = "true";
  const model = new ChatOpenAI({ temperature: 0 });
  const tools = [
    new SerpAPI(process.env.SERPAPI_API_KEY, {
      location: "Austin,Texas,United States",
      hl: "en",
      gl: "us",
    }),
    new Calculator(),
  ];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "chat-zero-shot-react-description",
    verbose: true,
  });

  const input = `What is 24,678,987 raised to the 0.23 power?`;

  console.log(`Executing with input "${input}"...`);

  const [resultA, resultB, resultC] = await Promise.all([
    executor.call({ input }),
    executor.call({ input }),
    executor.call({ input }),
  ]);

  console.log(`Got output ${resultA.output}`);
  console.log(`Got output ${resultB.output}`);
  console.log(`Got output ${resultC.output}`);
});
