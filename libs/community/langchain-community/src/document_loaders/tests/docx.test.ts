import { test, expect } from "@jest/globals";
import * as url from "node:url";
import * as path from "node:path";
import { DocxLoader } from "../fs/docx.js";

test("Test Word doc loader from .docx file", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/attention.docx"
  );
  const loader = new DocxLoader(filePath);
  const docs = await loader.load();

  expect(docs.length).toBe(1); // not much text in the example
  expect(docs[0].pageContent).toContain("an interesting activity");
});

test("Test Word doc loader from .doc file", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/attention.doc"
  );
  const loader = new DocxLoader(filePath, {
    type: "doc",
  });
  const docs = await loader.load();

  expect(docs.length).toBe(1); // not much text in the example
  expect(docs[0].pageContent).toContain("an interesting activity");
});
