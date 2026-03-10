import { test } from "@jest/globals";
import { HuggingFaceInference } from "../hf.js";

test.skip("Test HuggingFace", async () => {
  const model = new HuggingFaceInference({ temperature: 0.1, topP: 0.5 });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await model.invoke("1 + 1 =");
  // console.log(res);
}, 50000);

test.skip("Test HuggingFace with streaming", async () => {
  const model = new HuggingFaceInference({
    model: "mistralai/Mistral-7B-v0.1",
    temperature: 0.1,
    maxTokens: 10,
    topP: 0.5,
  });
  const stream = await model.stream("What is your name?");
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
    // console.log(chunk);
  }
  // console.log(chunks.join(""));
  expect(chunks.length).toBeGreaterThan(1);
}, 50000);

test.skip("Test HuggingFace with stop sequence", async () => {
  const model = new HuggingFaceInference({
    model: "mistralai/Mistral-7B-v0.1",
    temperature: 0.1,
    topP: 0.5,
  });
  await model
    .withConfig({
      stop: ["ramento"],
    })
    .invoke(`What is the capital of California?`);
  // console.log(res);
}, 50000);
