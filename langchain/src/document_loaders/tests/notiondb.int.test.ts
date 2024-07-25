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
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const documents = await loader.load();
  // console.log({ documents });
});
