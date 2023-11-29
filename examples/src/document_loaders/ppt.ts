import { PPTXLoader } from "langchain/document_loaders/fs/pptx";

export const run = async () => {
  const loader = new PPTXLoader(
    "src/document_loaders/example_data/theikuntest.pptx"
  );

  const docs = await loader.load();

  console.log({ docs });
};
