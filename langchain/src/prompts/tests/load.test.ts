import { expect, test } from "@jest/globals";
import path from "path";
import { fileURLToPath } from "node:url";
import { loadPrompt } from "../load.js";

const PROMPTS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "prompts"
);

test("Load Hello World Prompt", async () => {
  const helloWorld = path.join(PROMPTS_DIR, "hello_world.yaml");
  const prompt = await loadPrompt(helloWorld);
  expect(prompt._getPromptType()).toBe("prompt");
  expect(await prompt.format({})).toBe("Say hello world.");
});

test("Load hub prompt", async () => {
  const prompt = await loadPrompt(
    "lc@abb92d8://prompts/hello-world/prompt.yaml"
  );
  expect(prompt._getPromptType()).toBe("prompt");
  expect(await prompt.format({})).toBe("Say hello world.");
});
