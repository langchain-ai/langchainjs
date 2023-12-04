import { GithubRepoLoader } from "langchain/document_loaders/web/github";

export const run = async () => {
  const loader = new GithubRepoLoader(
    "https://github.com/langchain-ai/langchainjs",
    {
      branch: "main",
      recursive: false,
      unknown: "warn",
      maxConcurrency: 3, // Defaults to 2
    }
  );

  const docs = [];
  for await (const doc of loader.loadAsStream()) {
    docs.push(doc);
  }

  console.log({ docs });
};
