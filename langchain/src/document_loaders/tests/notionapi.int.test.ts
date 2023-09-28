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
    onDocumentLoaded: (current, total, currentTitle, rootTitle) => {
      console.log(
        `Loaded ${currentTitle} in ${rootTitle}:  (${current}/${total})`
      );
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
    onDocumentLoaded: (current, total, currentTitle, rootTitle) => {
      console.log(
        `Loaded ${currentTitle} in ${rootTitle}:  (${current}/${total})`
      );
    },
  });

  const docs = await loader.load();
  const titles = docs.map((doc) => doc.metadata.properties._title);
  console.log("Titles:", titles);
  console.log(`Loaded ${docs.length} pages from the database`);
});

test("Test Notion API Loader onDocumentLoad", async () => {
  const onDocumentLoadedCheck: string[] = [];
  const loader = new NotionAPILoader({
    clientOptions: {
      auth: process.env.NOTION_INTEGRATION_TOKEN,
    },
    id: process.env.NOTION_DATABASE_ID ?? "",
    onDocumentLoaded: (current, total, currentTitle, rootTitle) => {
      onDocumentLoadedCheck.push(
        `Loaded ${currentTitle} from ${rootTitle}: (${current}/${total})`
      );
    },
  });

  await loader.load();

  expect(onDocumentLoadedCheck.length).toBe(3);

  console.log(onDocumentLoadedCheck);
});
