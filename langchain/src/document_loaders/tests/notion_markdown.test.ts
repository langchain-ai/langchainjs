import { test, expect } from "@jest/globals";
import url from "node:url";
import path from "node:path";
import { NotionLoader } from "../notion_markdown.js";

test("Test Notion Loader", async () => {
  const directoryPath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data"
  );
  const loader = new NotionLoader(directoryPath);
  const docs = await loader.load();

  expect(docs.length).toBe(1);
  expect(docs[0].pageContent).toContain("Testing the notion markdownloader");
});
