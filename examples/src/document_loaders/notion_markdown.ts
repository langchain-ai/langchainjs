import {NotionLoader} from "langchain/document_loaders";

export const run = async () => {
  const loader = new NotionLoader(
    "src/document_loaders/example_data/notion.md"
  );
  const docs = await loader.load();
  console.log({ docs });
};
