/* eslint-disable no-process-env */
import * as uuid from "uuid";
import { test, expect } from "@jest/globals";

import { LangChainTracer, Run } from "../tracer_langchain.js";
import { Serialized } from "../../load/serializable.js";
import { HumanMessage } from "../../messages/index.js";

const serialized: Serialized = {
  lc: 1,
  type: "constructor",
  id: ["test"],
  kwargs: {},
};

test("LangChain V2 tracer does not throw errors for its methods", async () => {
  const tracer = new LangChainTracer({
    projectName: `JS Int Test - ${uuid.v4()}`,
  });
  const chainRunId = uuid.v4();
  const toolRunId = uuid.v4();
  const llmRunId = uuid.v4();
  const chatRunId = uuid.v4();
  await tracer.handleChainStart(serialized, { foo: "bar" }, chainRunId);
  await tracer.handleToolStart(serialized, "test", toolRunId, chainRunId);
  await tracer.handleLLMStart(serialized, ["test"], llmRunId, toolRunId);
  await tracer.handleLLMEnd({ generations: [[]] }, llmRunId);
  await tracer.handleChatModelStart(
    serialized,
    [[new HumanMessage("I'm a human.")]],
    chatRunId
  );
  await tracer.handleLLMEnd({ generations: [[]] }, chatRunId);
  await tracer.handleToolEnd("output", toolRunId);
  const llmRunId2 = uuid.v4();
  await tracer.handleLLMStart(serialized, ["test"], llmRunId2, chainRunId);
  await tracer.handleLLMEnd({ generations: [[]] }, llmRunId2);
  await tracer.handleChainEnd({ foo: "bar" }, chainRunId);

  const llmRunId3 = uuid.v4();
  await tracer.handleLLMStart(serialized, ["test"], llmRunId3);
  await tracer.handleLLMEnd({ generations: [[]] }, llmRunId3);
});

class FakeTracer extends LangChainTracer {
  createOperations: { [id: string]: Run } = {};

  updateOperations: { [id: string]: Run } = {};

  async onRunCreate(run: Run): Promise<void> {
    this.createOperations[run.id] = run;
  }

  async onRunUpdate(run: Run): Promise<void> {
    this.updateOperations[run.id] = run;
  }
}

test("LangChain V2 tracer creates and updates runs with trace_id and dotted_order", async () => {
  const tracer = new FakeTracer({
    projectName: `JS Int Test - ${uuid.v4()}`,
  });
  const chainRunId = uuid.v4();
  const llmRunId = uuid.v4();
  await tracer.handleChainStart(serialized, { foo: "bar" }, chainRunId);

  await tracer.handleLLMStart(serialized, ["test"], llmRunId, chainRunId);
  await tracer.handleLLMEnd({ generations: [[]] }, llmRunId);
  await tracer.handleChainEnd({ foo: "bar" }, chainRunId);

  expect(tracer.createOperations[chainRunId].trace_id).toBeDefined();
  expect(tracer.createOperations[chainRunId].trace_id).toEqual(chainRunId);
  expect(tracer.createOperations[chainRunId].dotted_order).toBeDefined();
  expect(tracer.updateOperations[llmRunId].trace_id).toBeDefined();
  expect(tracer.updateOperations[llmRunId].trace_id).toEqual(chainRunId);
  expect(tracer.updateOperations[llmRunId].dotted_order).toBeDefined();
});
