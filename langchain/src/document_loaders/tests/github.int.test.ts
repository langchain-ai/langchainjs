import { test } from "@jest/globals";
import { GithubRepoLoader } from "../web/github.js";

test("Test GithubRepoLoader", async () => {
  const loader = new GithubRepoLoader(
    "https://github.com/hwchase17/langchainjs",
    { branch: "main", recursive: false, unknown: "warn" }
  );
  const documents = await loader.load();
  console.log(documents[0].pageContent);
});
