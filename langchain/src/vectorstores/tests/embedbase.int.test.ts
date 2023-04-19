/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test, expect } from "@jest/globals";
import { createClient } from "embedbase-js";

import { Document } from "../../document.js";
import { EmbedbaseVectorStore } from "../embedbase.js";

test("EmbedbaseVectorStore with external ids", async () => {
  const client = createClient(
    process.env.EMBEDBASE_URL || "https://api.embedbase.xyz",
    process.env.EMBEDBASE_API_KEY
  );

  const store = new EmbedbaseVectorStore({ embedbase: client });

  expect(store).toBeDefined();

  await store.addDocuments([
    { pageContent: "hello", metadata: { a: 1 } },
    { pageContent: "hi", metadata: { a: 1 } },
    { pageContent: "bye", metadata: { a: 1 } },
    { pageContent: "what's this", metadata: { a: 1 } },
  ]);

  const results = await store.similaritySearch("hello", 1);

  expect(results).toHaveLength(1);

  expect(results).toEqual([
    new Document({ metadata: { a: 1 }, pageContent: "hello" }),
  ]);
});
