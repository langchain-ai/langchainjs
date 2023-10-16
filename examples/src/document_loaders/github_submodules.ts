import { GithubRepoLoader } from "langchain/document_loaders/web/github";

export const run = async () => {
  const loader = new GithubRepoLoader(
    "https://github.com/langchain-ai/langchainjs",
    {
      branch: "main",
      recursive: true,
      processSubmodules: true,
      unknown: "warn",
    }
  );
  const docs = await loader.load();
  console.log({ docs });
};
