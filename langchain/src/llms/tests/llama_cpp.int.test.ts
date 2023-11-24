/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "@jest/globals";
import { getEnvironmentVariable } from "../../util/env.js";
import { LlamaCpp } from "../llama_cpp.js";

const llamaPath = getEnvironmentVariable("LLAMA_PATH")!;

test.skip("Test Llama_CPP", async () => {
  const model = new LlamaCpp({ modelPath: llamaPath });
  const res = await model.call("Where do Llamas live?");
  console.log(res);
}, 100000);

test.skip("Test Llama_CPP", async () => {
  const model = new LlamaCpp({ modelPath: llamaPath });
  const res = await model.call("Where do Pandas live?");
  console.log(res);
}, 100000);

test.skip("Test Llama_CPP", async () => {
  const model = new LlamaCpp({ modelPath: llamaPath });

  // Attempt to make several queries and make sure that the system prompt
  // is not returned as part of any follow-on query.
  for (let i = 0; i < 5; i += 1) {
    const res = await model.call("Where do Pandas live?");
    expect(res).not.toContain(
      "You are a helpful, respectful and honest assistant."
    );
  }
}, 100000);

test.skip("Test Llama_CPP", async () => {
  const model = new LlamaCpp({ modelPath: llamaPath, temperature: 0.7 });

  const stream = await model.stream(
    "Tell me a short story about a happy Llama."
  );

  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
    process.stdout.write(chunks.join(""));
  }

  expect(chunks.length).toBeGreaterThan(1);
});
