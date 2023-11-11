import { GithubRepoLoader } from "langchain/document_loaders/web/github";

export const run = async () => {
  const loader = new GithubRepoLoader(
    "https://github.com/langchain-ai/langchainjs",
    {
      branch: "main",
      recursive: false,
      unknown: "warn",
      maxConcurrency: 5, // Defaults to 2
    }
  );
  const docs = await loader.load();
  console.log({ docs });
};
