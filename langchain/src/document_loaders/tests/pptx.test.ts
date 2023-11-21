import { expect, test } from "@jest/globals";
import * as url from "node:url";
import * as path from "node:path";
import { PPTXLoader } from "../fs/pptx.js";

test("Test PowerPoint loader from file", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/theikuntest.pptx"
  );
  const loader = new PPTXLoader(filePath);
  const docs = await loader.load();

  expect(docs.length).toBe(1); // not much text in the example
  expect(docs[0].pageContent).toContain("UTSC IS THE BEST");
});

test("Test PowerPoint loader from empty powerpoint file", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/emptyfile.pptx"
  );
  const loader = new PPTXLoader(filePath);
  const docs = await loader.load();

  expect(docs.length).toBe(0); // not much text in the example
});
