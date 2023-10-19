/* eslint-disable no-process-env */

import { ConvexHttpClient } from "convex/browser";

import { expect, test } from "@jest/globals";
// eslint-disable-next-line import/no-relative-packages
import { api } from "./convex/convex/_generated/api.js";

// To run these tests at least once, follow these steps:
//
// 1. `cd langchain/src/stores/tests/convex`
// 2. `npx convex dev --once`
// 3. `cd ../../../..`
// 3. `cp src/stores/tests/convex/.env.local .env`
// 4. Add your OpenAI key to `.env` (see `.env.example`)
// 5. `yarn test:single src/stores/tests/convex.int.test.ts`
//
// If you're developing these tests, after you've done the above:
//
// In `langchain/src/stores/tests/convex` run `npx convex dev`
// In `langchain` run `yarn test:single src/stores/tests/convex.int.test.ts`

const client = new ConvexHttpClient(process.env.CONVEX_URL as string);
const openAIApiKey = process.env.OPENAI_API_KEY as string;

test("Convex persisted LLM chat", async () => {
  await client.mutation(api.test.reset);

  const { response: result1 } = await client.action(api.test.chat, {
    openAIApiKey,
    sessionId: "1",
    input: "Hi! I'm Jim.",
  });

  console.log({ result1 });

  const { response: result2 } = await client.action(api.test.chat, {
    openAIApiKey,
    sessionId: "1",
    input: "What did I just say my name was?",
  });

  console.log({ result2 });

  expect(result2).toContain("Jim");

  const { response: result3 } = await client.action(api.test.chat, {
    openAIApiKey,
    sessionId: "2",
    input: "What did I just say my name was?",
  });

  console.log({ result3 });

  expect(result3).not.toContain("Jim");
});
