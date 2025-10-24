/* eslint-disable no-process-env */

import { ConvexHttpClient } from "convex/browser";

import { expect, test } from "@jest/globals";
// eslint-disable-next-line import/no-relative-packages
import { api } from "./convex/convex/_generated/api.js";

// To run these tests at least once, follow these steps:
//
// 1. `cd langchain/src/vectorstores/tests/convex`
// 2. `npx convex dev --once`
// 3. `cd ../../../..`
// 3. `cp src/vectorstores/tests/convex/.env.local .env`
// 4. Add your OpenAI key to `.env` (see `.env.example`)
// 5. `yarn test:single src/vectorstores/tests/convex.int.test.ts`
//
// If you're developing these tests, after you've done the above:
//
// In `langchain/src/vectorstores/tests/convex` run `npx convex dev`
// In `langchain` run `yarn test:single src/vectorstores/tests/convex.int.test.ts`

describe.skip("Convex Vectorstore", () => {
  test("Convex ingest, similaritySearch", async () => {
    const client = new ConvexHttpClient(process.env.CONVEX_URL as string);
    const openAIApiKey = process.env.OPENAI_API_KEY as string;

    await client.mutation(api.lib.reset);

    await client.action(api.lib.ingest, {
      openAIApiKey,
      texts: ["Hello world", "Bye bye", "hello nice world"],
      metadatas: [{ id: 2 }, { id: 1 }, { id: 3 }],
    });

    const metadatas = await client.action(api.lib.similaritySearch, {
      openAIApiKey,
      query: "hello world",
    });

    expect(metadatas).toEqual([{ id: 2 }, { id: 3 }, { id: 1 }]);
  });
});
