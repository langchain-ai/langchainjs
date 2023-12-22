import { test, expect } from "@jest/globals";
import { HumanMessage } from "@langchain/core/messages";
import { ChatCohere } from "../chat_model.js";

test.skip("ChatCohere can invoke", async () => {
  const model = new ChatCohere();
  const response = await model.invoke([new HumanMessage("Hello world")]);
  console.log(response.additional_kwargs);
  expect(response.content).toBeTruthy();
  expect(response.additional_kwargs).toBeTruthy();
});

// Adding this test because token count is not documented in their
// API docs or SDK types, but their API returns it.
test("ChatCohere can count tokens", async () => {
  const model = new ChatCohere();
  const response = await model.generate([[new HumanMessage("Hello world")]]);
  console.log(response);
  expect(response.llmOutput?.estimatedTokenUsage).toBeTruthy();
  expect(
    response.llmOutput?.estimatedTokenUsage.completionTokens
  ).toBeGreaterThan(1);
  expect(response.llmOutput?.estimatedTokenUsage.promptTokens).toBeGreaterThan(
    1
  );
  expect(response.llmOutput?.estimatedTokenUsage.totalTokens).toBeGreaterThan(
    1
  );
});

test("ChatCohere can stream", async () => {
  const model = new ChatCohere();
  const stream = await model.stream([new HumanMessage("Hello world")]);

  let tokens = "";
  let streamIters = 0;
  for await (const streamItem of stream) {
    tokens += streamItem.content;
    streamIters += 1;
    console.log(tokens);
  }
  expect(streamIters).toBeGreaterThan(1);
});
