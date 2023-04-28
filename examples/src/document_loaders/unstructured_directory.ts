import { UnstructuredDirectoryLoader } from "langchain/document_loaders/fs/unstructured";

const options = {
  "apiKey": "MY_API_KEY"
};

const loader = new UnstructuredDirectoryLoader(
  "langchain/src/document_loaders/tests/example_data",
  "https://api.unstructured.io/general/v0/general",
  options
);
const docs = await loader.load();
