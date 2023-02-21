import { IMSDBLoader } from "langchain/document_loaders";

export const run = async () => {
  const loader = new IMSDBLoader(
    "https://imsdb.com/scripts/BlacKkKlansman.html"
  );
  const docs = await loader.load();
  console.log({ docs });
};
