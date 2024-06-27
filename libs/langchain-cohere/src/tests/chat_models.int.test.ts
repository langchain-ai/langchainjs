/* eslint-disable no-promise-executor-return */
import { test, expect } from "@jest/globals";
import { AIMessageChunk, HumanMessage } from "@langchain/core/messages";
import { ChatCohere } from "../chat_models.js";

test("ChatCohere can invoke", async () => {
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

test("should abort the request", async () => {
  const cohere = new ChatCohere({
    model: "command-light",
  });
  const controller = new AbortController();

  await expect(async () => {
    const ret = cohere.invoke("Respond with an verbose response", {
      signal: controller.signal,
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    controller.abort();
    return ret;
  }).rejects.toThrow("AbortError");
});

test("Stream token count usage_metadata", async () => {
  const model = new ChatCohere({
    model: "command-light",
    temperature: 0,
  });
  let res: AIMessageChunk | null = null;
  let lastRes: AIMessageChunk | null = null;
  for await (const chunk of await model.stream(
    "Why is the sky blue? Be concise."
  )) {
    if (!res) {
      res = chunk;
    } else {
      res = res.concat(chunk);
    }
    lastRes = chunk;
  }
  console.log(res);
  expect(res?.usage_metadata).toBeDefined();
  if (!res?.usage_metadata) {
    return;
  }
  expect(res.usage_metadata.input_tokens).toBe(71);
  expect(res.usage_metadata.output_tokens).toBeGreaterThan(10);
  expect(res.usage_metadata.total_tokens).toBe(
    res.usage_metadata.input_tokens + res.usage_metadata.output_tokens
  );
  expect(lastRes?.additional_kwargs).toBeDefined();
  if (!lastRes?.additional_kwargs) {
    return;
  }
  expect(lastRes.additional_kwargs.eventType).toBe("stream-end");
});

test("streamUsage excludes token usage", async () => {
  const model = new ChatCohere({
    model: "command-light",
    temperature: 0,
    streamUsage: false,
  });
  let res: AIMessageChunk | null = null;
  let lastRes: AIMessageChunk | null = null;
  for await (const chunk of await model.stream(
    "Why is the sky blue? Be concise."
  )) {
    if (!res) {
      res = chunk;
    } else {
      res = res.concat(chunk);
    }
    lastRes = chunk;
  }
  console.log(res);
  expect(res?.usage_metadata).not.toBeDefined();
  if (res?.usage_metadata) {
    return;
  }
  expect(lastRes?.additional_kwargs).toBeDefined();
  if (!lastRes?.additional_kwargs) {
    return;
  }
  expect(lastRes.additional_kwargs.eventType).not.toBe("stream-end");
});

test("Invoke token count usage_metadata", async () => {
  const model = new ChatCohere({
    model: "command-light",
    temperature: 0,
  });
  const res = await model.invoke("Why is the sky blue? Be concise.");
  console.log(res);
  expect(res?.usage_metadata).toBeDefined();
  if (!res?.usage_metadata) {
    return;
  }
  expect(res.usage_metadata.input_tokens).toBe(71);
  expect(res.usage_metadata.output_tokens).toBeGreaterThan(10);
  expect(res.usage_metadata.total_tokens).toBe(
    res.usage_metadata.input_tokens + res.usage_metadata.output_tokens
  );
});
