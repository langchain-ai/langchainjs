/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "@jest/globals";
import { Client } from "@notionhq/client";
import { NotionAPILoader } from "../web/notionapi.js";

test("Test Notion MD Loader Page", async () => {
  const client = new Client({ auth: process.env.NOTION_INTEGRATION_TOKEN });
  const loader = new NotionAPILoader({
    client,
    id: process.env.NOTION_PAGE_ID ?? "",
    type: "page",
  });

  const docs = await loader.load();
  console.dir({ Page: docs }, { depth: Infinity });
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
});
