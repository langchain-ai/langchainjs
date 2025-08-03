/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatXAI } from "../chat_models.js";

beforeEach(() => {
  process.env.XAI_API_KEY = "foo";
});

test("Serialization", () => {
  delete process.env.XAI_API_KEY;
  const model = new ChatXAI({
    model: "grok-2-1212",
    apiKey: "bar",
  });
  expect(JSON.stringify(model)).toEqual(
    `{"lc":1,"type":"constructor","id":["langchain","chat_models","xai","ChatXAI"],"kwargs":{"model":"grok-2-1212"}}`
  );
});

test("Serialization with no params", () => {
  const model = new ChatXAI();
  expect(JSON.stringify(model)).toEqual(
    `{"lc":1,"type":"constructor","id":["langchain","chat_models","xai","ChatXAI"],"kwargs":{"model":"grok-beta"}}`
  );
});
