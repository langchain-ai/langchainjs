import { ObsidianLoader } from "langchain/document_loaders/fs/obsidian";

export const run = async () => {
  const loader = new ObsidianLoader(
    "src/document_loaders/example_data/obsidian"
  );

  const docs = await loader.load();

  console.log({ docs });
};
