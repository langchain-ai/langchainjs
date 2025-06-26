/* eslint-disable no-process-env */
import { test, expect } from "vitest";
import { ChatVertexAI } from "../../node.js";

test("Serialization", () => {
  const model = new ChatVertexAI();
  expect(JSON.stringify(model)).toEqual(
    `{"lc":1,"type":"constructor","id":["langchain","chat_models","vertexai","ChatVertexAI"],"kwargs":{"platform_type":"gcp"}}`
  );
});
