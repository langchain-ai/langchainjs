import { UnstructuredLoader } from "langchain/document_loaders/fs/unstructured";

const loader = new UnstructuredLoader(
  "src/document_loaders/example_data/notion.md",
  "https://api.unstructured.io/general/v0/general",
  "MY_API_KEY"
);
const docs = await loader.load();
