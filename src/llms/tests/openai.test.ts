import { test } from "@jest/globals";
import { OpenAI } from "../openai";

const baseParams = {
  temperature: 0.5,
  maxTokens: 10,
  topP: 1,
  frequencyPenalty: 1,
  presencePenalty: 1,
  n: 1,
  bestOf: 1,
};

test("Test OpenAI", async () => {
  const model = new OpenAI({
    ...baseParams,
  });

  const res = await model.call("Print hello world.");
  console.log({ res });
});
