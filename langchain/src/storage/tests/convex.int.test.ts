/* eslint-disable no-process-env */

import { ConvexHttpClient } from "convex/browser";

import { expect, test } from "@jest/globals";
// eslint-disable-next-line import/no-relative-packages
import { api } from "./convex/convex/_generated/api.js";

// To run these tests at least once, follow these steps:
//
// 1. `cd langchain/src/storage/tests/convex`
// 2. `npx convex dev --once`
// 3. `cd ../../../..`
// 3. `cp src/storage/tests/convex/.env.local .env`
// 4. `yarn test:single src/storage/tests/convex.int.test.ts`
//
// If you're developing these tests, after you've done the above:
//
// In `langchain/src/storage/tests/convex` run `npx convex dev`
// In `langchain` run `yarn test:single src/storage/tests/convex.int.test.ts`

const client = new ConvexHttpClient(process.env.CONVEX_URL as string);

test.skip("Convex set, get, delete", async () => {
  await client.mutation(api.test.reset);

  const value1 = new Date().toISOString();
  const value2 = new Date().toISOString() + new Date().toISOString();

  await client.action(api.test.mset, {
    pairs: [
      { key: "key1", value: value1 },
      { key: "key2", value: value2 },
    ],
  });

  const retrievedValues = await client.action(api.test.mget, {
    keys: ["key1", "key2"],
  });
  expect(retrievedValues).toEqual([value1, value2]);

  await client.action(api.test.mdelete, {
    keys: ["key1", "key2"],
  });

  const retrievedValues2 = await client.action(api.test.mget, {
    keys: ["key1", "key2"],
  });
  expect(retrievedValues2).toEqual(["undefined", "undefined"]);
});
