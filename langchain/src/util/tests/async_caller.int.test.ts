import { test, expect } from "@jest/globals";
import { AsyncCaller } from "../async_caller.js";
import { OpenAI } from "../../llms/openai.js";

test("AsyncCaller.call passes on arguments and returns return value", async () => {
  const caller = new AsyncCaller({});
  const callable = () => fetch("https://httpstat.us/200");

  const resultDirect = await callable();
  const resultWrapped = await caller.call(callable);

  expect(resultDirect.status).toEqual(200);
  expect(resultWrapped.status).toEqual(200);
});

test("AsyncCaller doesn't retry on axios error 401", async () => {
  const llm = new OpenAI({ openAIApiKey: "invalid" });

  await expect(() => llm.call("test")).rejects.toThrowError(
    "Request failed with status code 401"
  );
}, 5000);
