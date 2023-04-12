import { UnstructuredLoader } from "langchain/document_loaders/fs/unstructured";

export const run = async () => {
  const loader = new UnstructuredLoader(
    "http://localhost:8000/general/v0/general",
    "src/document_loaders/example_data/notion.md"
  );
  const docs = await loader.load();
  console.log({ docs });
};
