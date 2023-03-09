import { test } from "@jest/globals";
import { NotionLoader } from "document_loaders/notion_markdown.js";

test("Test Notion Loader", async () => {
  const loader = new NotionLoader(
    "../examples/src/document_loaders/example_data/notion.md"
  );
  await loader.load();
});
