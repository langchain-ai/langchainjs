import { UnstructuredLoader } from "langchain/document_loaders/fs/unstructured";

export const run = async () => {
  const loader = new UnstructuredDirectoryLoader(
    'https://api.unstructured.io/general/v0/general',
    'langchain/src/document_loaders/tests/example_data',
  );
  const docs = await loader.load();
  console.log({ docs });
};
