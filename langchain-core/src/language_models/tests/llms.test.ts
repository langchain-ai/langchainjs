/* eslint-disable no-promise-executor-return */

import { test } from "@jest/globals";
import { FakeLLM, FakeStreamingLLM } from "../../utils/testing/index.js";
import { HumanMessagePromptTemplate } from "../../prompts/chat.js";

test("Test FakeLLM uses callbacks", async () => {
  const model = new FakeLLM({});
  let acc = "";
  const response = await model.invoke("Hello there!", {
    callbacks: [
      {
        handleLLMNewToken: (token: string) => {
          console.log(token);
          acc += token;
        },
      },
    ],
  });
  expect(response).toEqual(acc);
});

test("Test FakeLLM uses callbacks with a cache", async () => {
  const model = new FakeLLM({
    cache: true,
  });
  let acc = "";
  const response = await model.invoke("Hello there!");
  const response2 = await model.invoke("Hello there!", {
    callbacks: [
      {
        handleLLMNewToken: (token: string) => {
          console.log(token);
          acc += token;
        },
      },
    ],
  });
  // If callbacks are backgrounded
  await new Promise((resolve) => setTimeout(resolve, 1000));
  expect(response).toEqual(response2);
  expect(response2).toEqual(acc);
});

test("Test FakeStreamingLLM works when streaming through a prompt", async () => {
  const prompt = HumanMessagePromptTemplate.fromTemplate("hello there {name}");
  const model = new FakeStreamingLLM({});
  const chain = prompt.pipe(model);
  const stream = await chain.stream({ name: "test" });
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  expect(chunks.length).toBeGreaterThan(1);
  expect(chunks.join("")).toEqual("Human: hello there test");
});
