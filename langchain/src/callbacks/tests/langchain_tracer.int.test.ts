import { test, expect } from "@jest/globals";

import { LangChainTracer } from "../tracers.js";

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
