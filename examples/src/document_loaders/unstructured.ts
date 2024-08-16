import { UnstructuredLoader } from "@langchain/unstructured";

const options = {
  apiKey: "MY_API_KEY",
};

const loader = new UnstructuredLoader(
  {
    filePath: "src/document_loaders/example_data/notion.md",
  },
  options
);
const docs = await loader.load();
