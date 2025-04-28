/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatGroq } from "../chat_models.js";

test("Serialization", () => {
  const model = new ChatGroq({
    apiKey: "foo",
    model: "llama-3.3-70b-versatile",
  });
  expect(JSON.stringify(model)).toEqual(
    `{"lc":1,"type":"constructor","id":["langchain","chat_models","groq","ChatGroq"],"kwargs":{"api_key":{"lc":1,"type":"secret","id":["GROQ_API_KEY"]},"model":"llama-3.3-70b-versatile"}}`
  );
});
