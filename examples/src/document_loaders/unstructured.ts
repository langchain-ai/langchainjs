import { UnstructuredLoader } from "langchain/document_loaders/fs/unstructured";

const options = {
  apiKey: "MY_API_KEY",
};

const loader = new UnstructuredLoader(
  "src/document_loaders/example_data/notion.md",
  options
);
const docs = await loader.load();
