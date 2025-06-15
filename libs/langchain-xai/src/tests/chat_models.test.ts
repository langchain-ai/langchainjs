/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatXAI } from "../chat_models.js";

test("Serialization", () => {
  const model = new ChatXAI({
    apiKey: "foo",
  });
  expect(JSON.stringify(model)).toEqual(
    `{"lc":1,"type":"constructor","id":["langchain","chat_models","xai","ChatXAI"],"kwargs":{"api_key":{"lc":1,"type":"secret","id":["XAI_API_KEY"]}}}`
  );
});

test("Serialization with no params", () => {
  process.env.GROQ_API_KEY = "foo";
  const model = new ChatXAI();
  expect(JSON.stringify(model)).toEqual(
    `{"lc":1,"type":"constructor","id":["langchain","chat_models","xai","ChatXAI"],"kwargs":{"api_key":{"lc":1,"type":"secret","id":["XAI_API_KEY"]}}}`
  );
});
