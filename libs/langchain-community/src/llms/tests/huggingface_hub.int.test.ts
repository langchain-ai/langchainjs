import { test } from "@jest/globals";
import { HuggingFaceInference } from "../hf.js";

test("Test HuggingFace", async () => {
  const model = new HuggingFaceInference({ temperature: 0.1, topP: 0.5 });
  const res = await model.call("1 + 1 =");
  console.log(res);
}, 50000);

test("Test HuggingFace with streaming", async () => {
  const model = new HuggingFaceInference({ temperature: 0.1, topP: 0.5 });
  const stream = await model.stream("1 + 1 =");
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  console.log(chunks.join(""));
}, 50000);
