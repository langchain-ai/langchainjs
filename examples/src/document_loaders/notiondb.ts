import { NotionDBLoader } from "langchain/document_loaders/web/notiondb";

const loader = new NotionDBLoader({
  integrationToken: "NOTION_TOKEN",
  databaseId: "databaseId",
});
const docs = await loader.load();

console.log({ docs });
