/* eslint-disable no-process-env */
import { test, expect } from "vitest";
import { VertexAI } from "../../node.js";

test("Serialization", () => {
  const model = new VertexAI();
  expect(JSON.stringify(model)).toEqual(
    `{"lc":1,"type":"constructor","id":["langchain","llms","vertexai","VertexAI"],"kwargs":{"platform_type":"gcp"}}`
  );
});
