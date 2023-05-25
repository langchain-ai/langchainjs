import { NotionDBLoader } from "langchain/document_loaders/web/notiondb";

const loader = new NotionDBLoader({
  pageSizeLimit: 10,
  databaseId: "databaseId",
});
const docs = await loader.load();

console.log({ docs });
