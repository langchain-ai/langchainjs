import { NotionLoader } from "langchain/document_loaders/fs/notion";

export const run = async () => {
  /** Provide the directory path of your notion folder */
  const directoryPath = "Notion_DB";
  const loader = new NotionLoader(directoryPath);
  const docs = await loader.load();
  console.log({ docs });
};
