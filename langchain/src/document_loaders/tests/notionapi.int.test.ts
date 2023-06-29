/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "@jest/globals";
import { NotionAPILoader } from "../web/notionapi.js";

test("Test Notion MD Loader Page", async () => {
  const loader = new NotionAPILoader({
    clientOptions: {
      auth: process.env.NOTION_INTEGRATION_TOKEN,
    },
    id: process.env.NOTION_PAGE_ID ?? "",
    type: "page",
  });

  const docs = await loader.loadAndSplit();
  console.dir({ Page: docs }, { depth: Infinity });
});

test("Test Notion Web Loader Database", async () => {
  const loader = new NotionAPILoader({
    clientOptions: {
      auth: process.env.NOTION_INTEGRATION_TOKEN,
    },
    id: process.env.NOTION_DATABASE_ID ?? "",
    type: "database",
  });

  const docs = await loader.loadAndSplit();
  console.dir({ Database: docs }, { depth: Infinity });
});
