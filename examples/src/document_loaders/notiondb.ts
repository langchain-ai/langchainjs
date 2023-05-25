import { NotionDBLoader } from "langchain/document_loaders/web/notiondb";

const loader = new NotionDBLoader({
  pageSizeLimit: 10,
  databaseId: "databaseId",
  notionIntegrationToken: "<your token here>", // Or set as process.env.NOTION_INTEGRATION_TOKEN
});
const docs = await loader.load();

console.log({ docs });
