/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "@jest/globals";
import { NotionAPILoader } from "../web/notionapi.js";

test("Test Notion API Loader Page", async () => {
  const loader = new NotionAPILoader({
    clientOptions: {
      auth: process.env.NOTION_INTEGRATION_TOKEN,
    },
    id: process.env.NOTION_PAGE_ID ?? "",
    onDocumentLoaded: (current, total, currentTitle) => {
      console.log(`Loaded Page: ${currentTitle} (${current}/${total})`);
    },
  });

  const docs = await loader.load();
  const titles = docs.map((doc) => doc.metadata.properties._title);
  console.log("Titles:", titles);
  console.log(`Loaded ${docs.length} pages`);
});

test("Test Notion API Loader Database", async () => {
  const loader = new NotionAPILoader({
    clientOptions: {
      auth: process.env.NOTION_INTEGRATION_TOKEN,
    },
    id: process.env.NOTION_DATABASE_ID ?? "",
    onDocumentLoaded: (current, total, currentTitle) => {
      console.log(`Loaded Page: ${currentTitle} (${current}/${total})`);
    },
  });

  const docs = await loader.load();
  const titles = docs.map((doc) => doc.metadata.properties._title);
  console.log("Titles:", titles);
  console.log(`Loaded ${docs.length} pages from the database`);
});
