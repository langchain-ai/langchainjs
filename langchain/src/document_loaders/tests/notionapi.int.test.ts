/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "@jest/globals";
import { NotionAPILoader } from "../web/notionapi.js";
import * as fs from "node:fs";
import YAML from "yaml";

test("Test Notion API Loader Page", async () => {
  const loader = new NotionAPILoader({
    clientOptions: {
      auth: process.env.NOTION_INTEGRATION_TOKEN,
    },
    limiterOptions: { maxConcurrent: 64, minTime: 64 },
    id: process.env.NOTION_PAGE_ID ?? "",
    type: "page",
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
    limiterOptions: { maxConcurrent: 64, minTime: 64 },
    id: process.env.NOTION_DATABASE_ID ?? "",
    type: "database",
  });

  let total = 0;
  loader.on("total_change", (pageTotal) => (total = pageTotal));
  loader.on("load", (current) =>
    console.log(`Loaded Page: ${current}/${total}`)
  );

  const docs = await loader.load();
  const titles = docs.map((doc) => doc.metadata.properties.title);
  console.log("Titles:", titles);
  console.log(`Loaded ${docs.length} pages from the database`);

  for (const doc of docs) {
    const fileName = doc.metadata.properties.title;
    const contents = `---\n${YAML.stringify(doc.metadata)}---
${doc.pageContent}`;
    fs.writeFileSync(
      `C:\\Users\\richa\\Desktop\\results\\${fileName}.md`,
      contents
    );
  }
});
