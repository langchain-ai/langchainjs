/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatVertexAI } from "../chat_models.js";

test("Serialization", () => {
  const model = new ChatVertexAI();
  expect(JSON.stringify(model)).toEqual(
    `{"lc":1,"type":"constructor","id":["langchain","chat_models","vertexai","ChatVertexAI"],"kwargs":{"platform_type":"gcp"}}`
  );
});

test("Labels parameter support", () => {
  // Verify that the model accepts labels parameter without throwing an error
  expect(() => {
    const model = new ChatVertexAI({
      labels: {
        team: "test",
        environment: "development",
      },
    });
    expect(model.platform).toEqual("gcp");
  }).not.toThrow();
});
