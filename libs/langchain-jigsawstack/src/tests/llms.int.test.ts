/* eslint-disable no-promise-executor-return, no-process-env */

import { test } from "@jest/globals";
import { JigsawStackPromptEngine } from "../llms.js";

test("test JigsawStackPromptEngine invoke", async () => {
  const promptEngine = new JigsawStackPromptEngine();
  const result = await promptEngine.invoke(
    "What is a good name for a company that makes colorful socks?"
  );
  expect(result).toBeTruthy();
  console.log({ result });
});

test("should abort the request", async () => {
  const promptEngine = new JigsawStackPromptEngine();

  const controller = new AbortController();

  await expect(async () => {
    const ret = promptEngine.invoke("Respond with an verbose response", {
      signal: controller.signal,
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    controller.abort();
    return ret;
  }).rejects.toThrow("AbortError");
});
