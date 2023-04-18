import { SRTLoader } from "langchain/document_loaders";

export const run = async () => {
  const loader = new SRTLoader(
    "src/document_loaders/example_data/Star_Wars_The_Clone_Wars_S06E07_Crisis_at_the_Heart.srt"
  );
  const docs = await loader.load();
  console.log({ docs });
};
