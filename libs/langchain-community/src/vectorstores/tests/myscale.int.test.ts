/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";

import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";

import { MyScaleStore } from "../myscale.js";

test.skip("MyScaleStore.fromText", async () => {
  const vectorStore = await MyScaleStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [
      { id: 2, name: "2" },
      { id: 1, name: "1" },
      { id: 3, name: "3" },
    ],
    new OpenAIEmbeddings(),
    {
      host: process.env.MYSCALE_HOST || "localhost",
      port: process.env.MYSCALE_PORT || "8443",
      username: process.env.MYSCALE_USERNAME || "username",
      password: process.env.MYSCALE_PASSWORD || "password",
    }
  );

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

test.skip("MyScaleStore.fromExistingIndex", async () => {
  await MyScaleStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [
      { id: 2, name: "2" },
      { id: 1, name: "1" },
      { id: 3, name: "3" },
    ],
    new OpenAIEmbeddings(),
    {
      host: process.env.MYSCALE_HOST || "localhost",
      port: process.env.MYSCALE_PORT || "8443",
      username: process.env.MYSCALE_USERNAME || "username",
      password: process.env.MYSCALE_PASSWORD || "password",
      table: "test_table",
    }
  );

  const vectorStore = await MyScaleStore.fromExistingIndex(
    new OpenAIEmbeddings(),
    {
      host: process.env.MYSCALE_HOST || "localhost",
      port: process.env.MYSCALE_PORT || "8443",
      username: process.env.MYSCALE_USERNAME || "username",
      password: process.env.MYSCALE_PASSWORD || "password",
      table: "test_table",
    }
  );

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
