import { NotionDBLoader } from "langchain/document_loaders/web/notiondb";

export const run = async () => {
  const loader = new NotionDBLoader({
    integrationToken: "NOTION_TOKEN",
    databaseId: "databaseId",
  });
  const docs = await loader.load();
  console.log({ docs });
};
