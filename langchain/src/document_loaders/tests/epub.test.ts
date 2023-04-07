import { test, expect } from "@jest/globals";
import * as url from "node:url";
import * as path from "node:path";
import { EPubLoader } from "../path/epub.js";

test("Test EPub loader from file", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/attention.epub"
  );
  const loader = new EPubLoader(filePath);
  const docs = await loader.load();

  expect(docs.length).toBe(3);
  expect(docs[0].pageContent).toContain("Attention Is All You Need");
});

test("Test EPub loader from file to single document", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/attention.epub"
  );
  const loader = new EPubLoader(filePath, { splitChapters: false });
  const docs = await loader.load();

  expect(docs.length).toBe(1);
  expect(docs[0].pageContent).toContain("Attention Is All You Need");
});
