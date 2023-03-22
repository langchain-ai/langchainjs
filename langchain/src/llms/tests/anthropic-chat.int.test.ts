import { expect, test } from "@jest/globals";
import { AI_PROMPT, AnthropicChat, HUMAN_PROMPT } from "../anthropic-chat.js";
import { CallbackManager } from "../../callbacks/index.js";

test("Test Anthropic", async () => {
  const model = new AnthropicChat({ modelName: "claude-v1", temperature: 0 });
  const res = await model.call("Who created you?");
  console.log({ res });
  expect(res.includes("Anthropic")).toBe(true);
});

test("Test Anthropic with raw prefix parameter", async () => {
  const model = new AnthropicChat({
    rawPrefix: `${HUMAN_PROMPT} Spell "Langchain" backwards.
    ${AI_PROMPT} "Langchain" spelled backwards is "Niachnagal".
    ${HUMAN_PROMPT}`,
  });
  const res = await model.call("Reverse it again.");
  console.log({ res });
});

test("Test Anthropic with prefix messages", async () => {
  const model = new AnthropicChat({
    prefixMessages: [
      { role: "user", content: `Spell "Cobb" backwards` },
      { role: "assistant", content: `"Cobb" spelled backwards is "bboC".` },
    ],
  });
  const res = await model.call(
    `Add "chicken" preceded by a space to the end of the result.`
  );
  console.log({ res });
});

test("Test Anthropic in streaming mode", async () => {
  let nrNewTokens = 0;
  let streamedCompletion = "";

  const model = new AnthropicChat({
    modelName: "claude-v1",
    streaming: true,
    callbackManager: CallbackManager.fromHandlers({
      async handleLLMNewToken(token: string) {
        nrNewTokens += 1;
        streamedCompletion += token;
      },
    }),
  });
  const res = await model.call("Who created you?");
  console.log({ res });

  expect(nrNewTokens > 0).toBe(true);
  expect(res).toBe(streamedCompletion);
}, 30000);
