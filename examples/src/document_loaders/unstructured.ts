import { UnstructuredLoader } from "langchain/document_loaders/fs/unstructured";

const loader = new UnstructuredLoader(
  "https://api.unstructured.io/general/v0/general",
  "src/document_loaders/example_data/notion.md",
  "MY_API_KEY"
);
const docs = await loader.load();
