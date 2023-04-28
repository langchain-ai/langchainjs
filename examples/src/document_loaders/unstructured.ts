import { UnstructuredLoader } from "langchain/document_loaders/fs/unstructured";

const options = {
  "apiKey": "MY_API_KEY"
};

const loader = new UnstructuredLoader(
  "src/document_loaders/example_data/notion.md",
  "https://api.unstructured.io/general/v0/general",
  options
);
const docs = await loader.load();
