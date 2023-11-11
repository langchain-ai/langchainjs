/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test, expect } from "@jest/globals";
import { promisify } from "util";
import { randomUUID } from "crypto";

import { ZepRetriever } from "../zep.js";
import { ZepMemory } from "../../memory/zep.js";

const baseURL = process.env.ZEP_API_URL || "http://localhost:8000";

test.skip("ZepRetriever - memory exists", async () => {
  const sessionId = randomUUID();
  const topK = 2; // The number of documents to retrieve

  const zepMemory = new ZepMemory({ sessionId, baseURL });
  const zepRetriever = new ZepRetriever({ sessionId, url: baseURL, topK });

  await zepMemory.saveContext(
    { input: "Who was Octavia Butler?" },
    {
      response:
        "Octavia Estelle Butler (June 22, 1947 – " +
        "February 24, 2006) was an American science fiction author.",
    }
  );

  // 2-second delay to wait for memory to be embedded
  // note that this may not be sufficient if OpenAI's API is slow
  const sleep = promisify(setTimeout);
  await sleep(2000);

  const docs = await zepRetriever.getRelevantDocuments("hello");

  expect(docs.length).toBeGreaterThanOrEqual(2);

  console.log(docs);
});

test.skip("ZepRetriever - does not exist", async () => {
  const sessionId = randomUUID();
  const topK = 2; // The number of documents to retrieve

  const zepRetriever = new ZepRetriever({ sessionId, url: baseURL, topK });

  const docs = await zepRetriever.getRelevantDocuments("hello");

  expect(docs.length).toBe(0);

  console.log(docs);
});
