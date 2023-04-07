import { test, expect } from "@jest/globals";
import * as url from "node:url";
import * as path from "node:path";
import { DocxLoader } from "../path/docx.js";

test("Test Word doc loader from file", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/attention.docx"
  );
  const loader = new DocxLoader(filePath);
  const docs = await loader.load();

  expect(docs.length).toBe(1); // not much text in the example
  expect(docs[0].pageContent).toContain("an interesting activity");
});
