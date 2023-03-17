import { test, expect } from "@jest/globals";

import {LangChainTracer, TRACER_RUN_ID} from "../tracers.js";
import { OpenAI } from "../../llms/index.js";
import { Calculator, SerpAPI } from "../../agents/tools/index.js";
import { initializeAgentExecutor } from "../../agents/index.js";

test("Test LangChain tracer", async () => {
  const tracer = new LangChainTracer();
  expect(tracer.alwaysVerbose).toBe(true);

  let values;
  values = await tracer.handleChainStart({ name: "test" }, { foo: "bar" });
  const runIdA = values[TRACER_RUN_ID];

  values = await tracer.handleToolStart({ name: "test" }, "test", runIdA);
  const runIdB = values[TRACER_RUN_ID];

  values = await tracer.handleLLMStart({ name: "test" }, ["test"], runIdB);
  const runIdC = values[TRACER_RUN_ID];

  await tracer.handleLLMEnd({ generations: [[]] }, runIdC);
  await tracer.handleToolEnd("output", runIdB);

  values = await tracer.handleLLMStart({ name: "test2" }, ["test"], runIdA);
  const runIdD = values[TRACER_RUN_ID];

  await tracer.handleLLMEnd({ generations: [[]] }, runIdD);
  await tracer.handleChainEnd({ foo: "bar" }, runIdA);
});

test.skip("Test Traced Agent with concurrency (skipped until we fix concurrency)", async () => {
  process.env.LANGCHAIN_HANDLER = "langchain";
  const model = new OpenAI({ temperature: 0 });
  const tools = [new SerpAPI(), new Calculator()];

  const executor = await initializeAgentExecutor(
    tools,
    model,
    "zero-shot-react-description",
    true
  );

  const input = `Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?`;

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
