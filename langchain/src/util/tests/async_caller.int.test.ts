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

test("AsyncCaller doesn't retry on timeout", async () => {
  const caller = new AsyncCaller({});
  const callable = () =>
    fetch("https://httpstat.us/200?sleep=1000", {
      signal: AbortSignal.timeout(10),
    });

  await expect(() => caller.call(callable)).rejects.toThrowError(
    "TimeoutError: The operation was aborted due to timeout"
  );
}, 5000);

test("AsyncCaller doesn't retry on signal abort", async () => {
  const controller = new AbortController();
  const caller = new AsyncCaller({});
  const callable = () => {
    const ret = fetch("https://httpstat.us/200?sleep=1000", {
      signal: controller.signal,
    });

    controller.abort();

    return ret;
  };

  await expect(() => caller.call(callable)).rejects.toThrowError(
    "AbortError: This operation was aborted"
  );
}, 5000);
