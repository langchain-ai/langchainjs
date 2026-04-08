import { test, expect } from "vitest";
import { VertexAI } from "../llms.js";

test("Serialization", () => {
  const model = new VertexAI();
  expect(JSON.stringify(model)).toEqual(
    `{"lc":1,"type":"constructor","id":["langchain","llms","vertexai","VertexAI"],"kwargs":{"platform_type":"gcp"}}`
  );
});
