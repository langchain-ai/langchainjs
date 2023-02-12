import { test } from "@jest/globals";
import { OpenAI } from "../openai";

test("Test OpenAI", async () => {
  const model = new OpenAI({ maxTokens: 5 });
  const res = await model.call("Print hello world");
  console.log({ res });
});
