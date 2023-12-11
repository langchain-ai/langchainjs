/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "@jest/globals";
import { NotionAPILoader } from "../web/notionapi.js";

test.skip("Test Notion API Loader Page", async () => {
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

test.skip("Test Notion API Loader Database", async () => {
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

test.skip("Test Notion API Loader onDocumentLoad", async () => {
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
    propertiesAsHeader: true,
  });

  await loader.load();

  expect(onDocumentLoadedCheck.length).toBe(3);

  console.log(onDocumentLoadedCheck);
});

test.skip("Test docs with empty database page content", async () => {
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

  const docs = await loader.load();

  expect(docs.length).toBe(0);
});

test.skip("Test docs with empty database page content and propertiesAsHeader enabled", async () => {
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
    propertiesAsHeader: true,
  });

  const docs = await loader.load();

  expect(docs.length).toBe(3);

  console.log(docs);
});
