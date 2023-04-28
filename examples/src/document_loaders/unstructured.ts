import { UnstructuredLoader } from "langchain/document_loaders/fs/unstructured";

const loader = new UnstructuredLoader(
  "https://api.unstructured.io/general/v0/general",
  "src/document_loaders/example_data/notion.md"
);
const docs = await loader.load();
