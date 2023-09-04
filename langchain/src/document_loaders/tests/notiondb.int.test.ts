/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "@jest/globals";

import { NotionDBLoader } from "../web/notiondb.js";

test.skip("Test NotionDBLoader", async () => {
  const loader = new NotionDBLoader({
    pageSizeLimit: 10,
    notionApiVersion: "2022-06-28",
    databaseId: process.env.NOTION_DATABASE_ID!,
  });
  const documents = await loader.load();
  console.log({ documents });
});
