import { test, expect } from "vitest";
import { Client } from "langsmith";
import { LangSmithLoader } from "../langsmith.js";

const DATASET_NAME = "brace-test-dataset";
const DATASET_ID = "9a3b36f7-a297-40a5-944d-6613853b6330";

test("LangSmithLoader can load with client passed in", async () => {
  const lsClient = new Client();
  const loader = new LangSmithLoader({
    datasetId: DATASET_ID,
    client: lsClient,
  });
  const docs = await loader.load();

  expect(docs.length).toBeGreaterThanOrEqual(1);
  const parsedContent = JSON.parse(docs[0].pageContent);
  expect(parsedContent).toHaveProperty("input_key_str");
  expect(parsedContent.input_key_str).toBe("string");
  expect(parsedContent).toHaveProperty("input_key_bool");
  expect(parsedContent.input_key_bool).toBe(true);

  expect(docs[0].metadata).toHaveProperty("created_at");
  expect(typeof docs[0].metadata.created_at).toBe("string");
  expect(docs[0].metadata).toHaveProperty("modified_at");
  expect(typeof docs[0].metadata.modified_at).toBe("string");
});

test("LangSmithLoader can load with client options passed in", async () => {
  const lsApiKey = process.env.LANGCHAIN_API_KEY;
  // unassign the API key to confirm the client isn't overriding what we passed in.
  process.env.LANGCHAIN_API_KEY = "";

  try {
    const lsConfigArgs = {
      apiKey: lsApiKey,
    };
    const loader = new LangSmithLoader({
      datasetId: DATASET_ID,
      clientConfig: lsConfigArgs,
    });
    const docs = await loader.load();

    expect(docs.length).toBeGreaterThanOrEqual(1);
  } finally {
    process.env.LANGCHAIN_API_KEY = lsApiKey;
  }
});

test("LangSmithLoader can load with dataset name", async () => {
  const loader = new LangSmithLoader({ datasetName: DATASET_NAME });
  const docs = await loader.load();

  expect(docs.length).toBeGreaterThanOrEqual(1);
});

test("Passing content key correctly loads that value", async () => {
  const loader = new LangSmithLoader({
    datasetName: DATASET_NAME,
    contentKey: "input_key_str",
  });
  const docs = await loader.load();

  expect(docs[0].pageContent).toBe("string");
});
