import { test, expect } from "@jest/globals";
import { NotionAPILoader } from "../web/notionapi.js";
import { Client } from "@notionhq/client";

test("Test Notion MD Loader Page", async () => {
  const client = new Client({ auth: process.env.NOTION_INTEGRATION_TOKEN });
  const loader = new NotionAPILoader({
    client,
    id: process.env.NOTION_PAGE_ID ?? "",
    type: "page",
  });
  await loader.load();

  const docs = await loader.load();
  console.dir({ Page: docs }, { depth: Infinity });

  expect(true);
});

test("Test Notion Web Loader Database", async () => {
  const client = new Client({ auth: process.env.NOTION_INTEGRATION_TOKEN });
  const loader = new NotionAPILoader({
    client,
    id: process.env.NOTION_DATABASE_ID ?? "",
    type: "database",
  });
  const docs = await loader.load();

  console.dir({ docs }, { depth: Infinity });

  expect(true);
});
