import { test, expect } from "@jest/globals";
import { OpenAI } from "../openai.js";

test("Test OpenAI", async () => {
  const model = new OpenAI({ maxTokens: 5, modelName: "text-ada-001" });
  const res = await model.call("Print hello world");
  console.log({ res });
});

test("Test OpenAI in streaming mode", async () => {
  let nrNewTokens = 0;
  const model = new OpenAI({
    maxTokens: 5,
    modelName: "text-ada-001",
    streaming: true,
    callbackManager: {
      handleNewToken() {
        nrNewTokens += 1;
      },
    },
  });
  const res = await model.call("Print hello world");
  console.log({ res });

  expect(nrNewTokens > 0).toBe(true);
});
