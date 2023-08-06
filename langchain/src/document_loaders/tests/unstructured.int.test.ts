/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import * as url from "node:url";
import * as path from "node:path";
import { test, expect } from "@jest/globals";
import {
  UnstructuredDirectoryLoader,
  UnstructuredLoader,
  UnknownHandling,
} from "../fs/unstructured.js";

test("Test Unstructured base loader", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/example.txt"
  );

  const options = {
    apiKey: process.env.UNSTRUCTURED_API_KEY!,
  };

  const loader = new UnstructuredLoader(filePath, options);
  const docs = await loader.load();

  expect(docs.length).toBe(3);
  for (const doc of docs) {
    expect(typeof doc.pageContent).toBe("string");
  }
});

test("Test Unstructured base loader with fast strategy", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/1706.03762.pdf"
  );

  const options = {
    apiKey: process.env.UNSTRUCTURED_API_KEY!,
    strategy: "fast",
  };

  const loader = new UnstructuredLoader(filePath, options);
  const docs = await loader.load();

  expect(docs.length).toBeGreaterThan(10);
  expect(typeof docs[0].pageContent).toBe("string");
});

test("Test Unstructured directory loader", async () => {
  const directoryPath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data"
  );

  const options = {
    apiKey: process.env.UNSTRUCTURED_API_KEY!,
    strategy: "fast",
  };

  const loader = new UnstructuredDirectoryLoader(
    directoryPath,
    options,
    true,
    UnknownHandling.Ignore
  );
  const docs = await loader.load();

  expect(docs.length).toBeGreaterThan(100);
  expect(typeof docs[0].pageContent).toBe("string");
});
