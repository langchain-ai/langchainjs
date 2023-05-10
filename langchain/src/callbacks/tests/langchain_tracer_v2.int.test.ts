/* eslint-disable no-process-env */
import * as uuid from "uuid";
import { test } from "@jest/globals";

import { LangChainTracerV2 } from "../handlers/tracers.js";

test("Test LangChain V2 tracer", async () => {
  const tracer = new LangChainTracerV2();
  await tracer.newSession(`Some Session Name - ${uuid.v4()}`);
  const chainRunId = uuid.v4();
  const toolRunId = uuid.v4();
  const llmRunId = uuid.v4();
  await tracer.handleChainStart({ name: "test" }, { foo: "bar" }, chainRunId);
  await tracer.handleToolStart({ name: "test" }, "test", toolRunId, chainRunId);
  await tracer.handleLLMStart({ name: "test" }, ["test"], llmRunId, toolRunId);
  await tracer.handleLLMEnd({ generations: [[]] }, llmRunId);
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
