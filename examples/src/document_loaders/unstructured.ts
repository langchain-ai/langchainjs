import { UnstructuredLoader } from "langchain/document_loaders";

export const run = async () => {
  const loader = new UnstructuredLoader(
    "http://localhost:8000/general/v0/general",
    "langchain/src/document_loaders/tests/example_data/example.txt"
  );
  const docs = await loader.load();
  console.log({ docs });
};
