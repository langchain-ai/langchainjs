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
  });

  const docs = await loader.load();
  console.log(`Loaded ${docs.length} pages`);
  // console.dir({ Pages: docs }, { depth: Infinity });
});

test("Test Notion API Loader Database", async () => {
  const loader = new NotionAPILoader({
    clientOptions: {
      auth: process.env.NOTION_INTEGRATION_TOKEN,
    },
    id: process.env.NOTION_DATABASE_ID ?? "",
  });

  let total = 0;
  loader.on("total_change", (pageTotal) => {
    total = pageTotal;
  });
  loader.on("load", (title, current) =>
    console.log(`Loaded Page: ${title} (${current}/${total})`)
  );

  const docs = await loader.load();
  const titles = docs.map((doc) => doc.metadata.properties.title);
  console.log("Titles:", titles);
  console.log(`Loaded ${docs.length} pages from the database`);
});
