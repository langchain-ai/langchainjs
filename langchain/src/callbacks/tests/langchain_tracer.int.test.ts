import { test, expect } from "@jest/globals";

import { LangChainTracer } from "../tracers.js";
import { OpenAI } from "../../llms/index.js";
import { Calculator, SerpAPI } from "../../agents/tools/index.js";
import { initializeAgentExecutor } from "../../agents/index.js";

test("Test LangChain tracer", async () => {
  const tracer = new LangChainTracer();
  expect(tracer.alwaysVerbose).toBe(true);

  await tracer.handleChainStart({ name: "test" }, { foo: "bar" });
  await tracer.handleToolStart({ name: "test" }, "test");
  await tracer.handleLLMStart({ name: "test" }, ["test"]);
  await tracer.handleLLMEnd({ generations: [[]] });
  await tracer.handleToolEnd("output");
  await tracer.handleLLMStart({ name: "test2" }, ["test"]);
  await tracer.handleLLMEnd({ generations: [[]] });
  await tracer.handleChainEnd({ foo: "bar" });

  await tracer.handleLLMStart({ name: "test" }, ["test"]);
  await tracer.handleLLMEnd({ generations: [[]] });
});

test("Test Traced Agent with concurrency", async () => {
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
