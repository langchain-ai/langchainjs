/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { Document } from "@langchain/core/documents";

import { ClickHouseStore } from "../clickhouse.js";
// Import OpenAIEmbeddings if you have a valid OpenAI API key
import { HuggingFaceInferenceEmbeddings } from "../../embeddings/hf.js";

test.skip("ClickHouseStore.fromText", async () => {
  const vectorStore = await ClickHouseStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [
      { id: 2, name: "2" },
      { id: 1, name: "1" },
      { id: 3, name: "3" },
    ],
    new HuggingFaceInferenceEmbeddings(),
    {
      host: process.env.CLICKHOUSE_HOST || "localhost",
      port: process.env.CLICKHOUSE_PORT || "8443",
      username: process.env.CLICKHOUSE_USERNAME || "username",
      password: process.env.CLICKHOUSE_PASSWORD || "password",
    }
  );

  // Sleep 1 second to ensure that the search occurs after the successful insertion of data.
  // eslint-disable-next-line no-promise-executor-return
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const results = await vectorStore.similaritySearch("hello world", 1);
  expect(results).toEqual([
    new Document({
      pageContent: "Hello world",
      metadata: { id: 2, name: "2" },
    }),
  ]);

  const filteredResults = await vectorStore.similaritySearch("hello world", 1, {
    whereStr: "metadata.name = '1'",
  });
  expect(filteredResults).toEqual([
    new Document({
      pageContent: "Bye bye",
      metadata: { id: 1, name: "1" },
    }),
  ]);
});

test.skip("ClickHouseStore.fromExistingIndex", async () => {
  await ClickHouseStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [
      { id: 2, name: "2" },
      { id: 1, name: "1" },
      { id: 3, name: "3" },
    ],
    new HuggingFaceInferenceEmbeddings(),
    {
      host: process.env.CLICKHOUSE_HOST || "localhost",
      port: process.env.CLICKHOUSE_PORT || "8443",
      username: process.env.CLICKHOUSE_USERNAME || "username",
      password: process.env.CLICKHOUSE_PASSWORD || "password",
      table: "test_table",
    }
  );

  const vectorStore = await ClickHouseStore.fromExistingIndex(
    new HuggingFaceInferenceEmbeddings(),
    {
      host: process.env.CLICKHOUSE_HOST || "localhost",
      port: process.env.CLICKHOUSE_PORT || "8443",
      username: process.env.CLICKHOUSE_USERNAME || "username",
      password: process.env.CLICKHOUSE_PASSWORD || "password",
      table: "test_table",
    }
  );

  // Sleep 1 second to ensure that the search occurs after the successful insertion of data.
  // eslint-disable-next-line no-promise-executor-return
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const results = await vectorStore.similaritySearch("hello world", 1);
  expect(results).toEqual([
    new Document({
      pageContent: "Hello world",
      metadata: { id: 2, name: "2" },
    }),
  ]);

  const filteredResults = await vectorStore.similaritySearch("hello world", 1, {
    whereStr: "metadata.name = '1'",
  });
  expect(filteredResults).toEqual([
    new Document({
      pageContent: "Bye bye",
      metadata: { id: 1, name: "1" },
    }),
  ]);
});
