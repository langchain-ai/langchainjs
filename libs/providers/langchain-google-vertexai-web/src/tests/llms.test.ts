import { test, expect } from "@jest/globals";
import { VertexAI } from "../llms.js";

test("Serialization", () => {
  const model = new VertexAI({
    authOptions: {
      credentials: "foo",
    },
  });
  expect(JSON.stringify(model)).toEqual(
    `{"lc":1,"type":"constructor","id":["langchain","llms","vertexai","VertexAI"],"kwargs":{"auth_options":{"lc":1,"type":"secret","id":["GOOGLE_AUTH_OPTIONS"]},"platform_type":"gcp"}}`
  );
});
