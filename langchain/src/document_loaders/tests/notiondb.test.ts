import { NotionDBLoader } from "../web/notiondb.js";
// eslint-disable-next-line import/order
import { test } from "@jest/globals";

test("Test NotionDBLoader", async () => {
  const loader = new NotionDBLoader({
    pageSizeLimit: 10,
    notionApiVersion: '2022-06-28',
    databaseId: "databaseId",
  });
  const documents = await loader.load();
  console.log(documents[0].pageContent);
});
