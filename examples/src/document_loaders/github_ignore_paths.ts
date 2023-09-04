import { GithubRepoLoader } from "langchain/document_loaders/web/github";

export const run = async () => {
  const loader = new GithubRepoLoader(
    "https://github.com/hwchase17/langchainjs",
    { branch: "main", recursive: false, unknown: "warn", ignorePaths: ["*.md"] }
  );
  const docs = await loader.load();
  console.log({ docs });
  // Will not include any .md files
};
