/* eslint-disable no-process-env */
import * as uuid from "uuid";
import { test } from "@jest/globals";

import { LangChainTracerV1 } from "../handlers/tracer_langchain_v1.js";
import { OpenAI } from "../../llms/openai.js";
import { SerpAPI } from "../../tools/index.js";
import { Calculator } from "../../tools/calculator.js";
import { initializeAgentExecutorWithOptions } from "../../agents/index.js";
import { HumanMessage } from "../../schema/index.js";
import { Serialized } from "../../load/serializable.js";

const serialized: Serialized = {
  lc: 1,
  type: "constructor",
  id: ["test"],
  kwargs: {},
};

test("Test LangChain tracer", async () => {
  const tracer = new LangChainTracerV1();
  const chatRunId = uuid.v4();
  const chainRunId = uuid.v4();
  const toolRunId = uuid.v4();
  const llmRunId = uuid.v4();
  await tracer.handleChatModelStart(
    serialized,
    [[new HumanMessage("this is a message")]],
    chatRunId
  );
  await tracer.handleLLMEnd({ generations: [[]] }, chatRunId);
  await tracer.handleChainStart(serialized, { foo: "bar" }, chainRunId);
  await tracer.handleToolStart(serialized, "test", toolRunId, chainRunId);
  await tracer.handleLLMStart(serialized, ["test"], llmRunId, toolRunId);
  await tracer.handleLLMEnd({ generations: [[]] }, llmRunId);
  await tracer.handleToolEnd("output", toolRunId);
  const llmRunId2 = uuid.v4();
  await tracer.handleLLMStart(serialized, ["test"], llmRunId2, chainRunId);
  await tracer.handleLLMEnd({ generations: [[]] }, llmRunId2);
  await tracer.handleChainEnd({ foo: "bar" }, chainRunId);

  const llmRunId3 = uuid.v4();
  await tracer.handleLLMStart(serialized, ["test"], llmRunId3);
  await tracer.handleLLMEnd({ generations: [[]] }, llmRunId3);
});

test("Test Traced Agent with concurrency", async () => {
  process.env.LANGCHAIN_TRACING = "true";
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
