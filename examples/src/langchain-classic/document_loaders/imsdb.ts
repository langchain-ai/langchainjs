import { IMSDBLoader } from "@langchain/community/document_loaders/web/imsdb";

export const run = async () => {
  const loader = new IMSDBLoader(
    "https://imsdb.com/scripts/BlacKkKlansman.html"
  );
  const docs = await loader.load();
  console.log({ docs });
};
