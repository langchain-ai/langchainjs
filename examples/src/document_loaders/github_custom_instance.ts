import { GithubRepoLoader } from "langchain/document_loaders/web/github";

export const run = async () => {
  const loader = new GithubRepoLoader(
    "https://github.your.company/org/repo-name",
    {
      baseUrl: "https://github.your.company",
      apiUrl: "https://github.your.company/api/v3",
      accessToken: "ghp_A1B2C3D4E5F6a7b8c9d0",
      branch: "main",
      recursive: true,
      unknown: "warn",
    }
  );
  const docs = await loader.load();
  console.log({ docs });
};
