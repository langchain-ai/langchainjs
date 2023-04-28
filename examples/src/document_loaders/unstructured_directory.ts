import { UnstructuredDirectoryLoader } from "langchain/document_loaders/fs/unstructured";

const loader = new UnstructuredDirectoryLoader(
  "langchain/src/document_loaders/tests/example_data",
  "https://api.unstructured.io/general/v0/general",
  "MY_API_KEY"
);
const docs = await loader.load();
