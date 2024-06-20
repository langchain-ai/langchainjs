import { test } from "@jest/globals";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { CloudflareWorkersAI } from "../llms.js";

test("Test CloudflareWorkersAI", async () => {
  const model = new CloudflareWorkersAI({});
  const res = await model.invoke("1 + 1 =");
  console.log(res);
}, 50000);

test("generate with streaming true", async () => {
  const model = new CloudflareWorkersAI({
    streaming: true,
  });
  const tokens: string[] = [];
  const res = await model.invoke("What is 2 + 2?", {
    callbacks: [
      {
        handleLLMNewToken: (token) => {
          console.log(token);
          tokens.push(token);
        },
      },
    ],
  });
  expect(tokens.length).toBeGreaterThan(1);
  expect(tokens.join("")).toEqual(res);
});

test("Test CloudflareWorkersAI streamingg", async () => {
  const model = new CloudflareWorkersAI({});
  const stream = await model.stream("What is 2 + 2?");
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
    console.log(chunk);
  }
  expect(chunks.length).toBeGreaterThan(1);
  console.log(chunks.join(""));
}, 50000);

test.skip("Test custom base url", async () => {
  const model = new CloudflareWorkersAI({
    baseUrl: `https://gateway.ai.cloudflare.com/v1/${getEnvironmentVariable(
      "CLOUDFLARE_ACCOUNT_ID"
    )}/lang-chainjs/workers-ai/`,
  });
  const res = await model.invoke("1 + 1 =");
  console.log(res);
});
