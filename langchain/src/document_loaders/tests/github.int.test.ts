import { test } from "@jest/globals";
import { GithubRepoLoader } from "../github.js";

test("Test GithubRepoLoader", async () => {
  const loader = new GithubRepoLoader(
    "https://github.com/hwchase17/langchainjs",
    "main",
    false
  );
  const documents = await loader.load();
  console.log(documents[0].pageContent);
}, 10000);
