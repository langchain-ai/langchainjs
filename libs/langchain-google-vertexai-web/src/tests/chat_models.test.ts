/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatVertexAI } from "../chat_models.js";

test("Serialization", () => {
  const model = new ChatVertexAI({
    authOptions: {
      credentials: "foo",
    },
  });
  expect(JSON.stringify(model)).toEqual(
    `{"lc":1,"type":"constructor","id":["langchain","chat_models","vertexai","ChatVertexAI"],"kwargs":{"auth_options":{"lc":1,"type":"secret","id":["GOOGLE_AUTH_OPTIONS"]},"platform_type":"gcp"}}`
  );
});
