import { UnstructuredDirectoryLoader } from "langchain/document_loaders/fs/unstructured";

const options = {
  apiKey: "MY_API_KEY",
};

const loader = new UnstructuredDirectoryLoader(
  "langchain/src/document_loaders/tests/example_data",
  options
);
const docs = await loader.load();
