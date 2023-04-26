import { UnstructuredDirectoryLoader } from "langchain/document_loaders/fs/unstructured";

const loader = new UnstructuredDirectoryLoader(
  "https://api.unstructured.io/general/v0/general",
  "langchain/src/document_loaders/tests/example_data",
  "MY_API_KEY"
);
const docs = await loader.load();
