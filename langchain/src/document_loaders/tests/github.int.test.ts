import { test } from "@jest/globals";
import { GithubRepoLoader } from "../web/github.js";

test("Test GithubRepoLoader", async () => {
  const loader = new GithubRepoLoader(
    "https://github.com/langchain-ai/langchainjs",
    { branch: "main", recursive: false, unknown: "warn" }
  );
  const documents = await loader.load();
  expect(
    documents.filter((document) => document.metadata.source === "yarn.lock")
      .length
  ).toBe(1);
  expect(
    documents.filter((document) => document.metadata.source === "README.md")
      .length
  ).toBe(1);
  console.log(documents[0].pageContent);
});

test("Test ignoreFiles with GithubRepoLoader", async () => {
  const loader = new GithubRepoLoader(
    "https://github.com/langchain-ai/langchainjs",
    {
      branch: "main",
      recursive: false,
      unknown: "warn",
      ignoreFiles: ["yarn.lock", "README.md"],
    }
  );
  const documents = await loader.load();
  expect(
    documents.filter((document) => document.metadata.source === "yarn.lock")
      .length
  ).toBe(0);
  expect(
    documents.filter((document) => document.metadata.source === "README.md")
      .length
  ).toBe(0);
  console.log(documents[0].pageContent);
});

test("Test ignorePaths with GithubRepoLoader", async () => {
  const loader = new GithubRepoLoader(
    "https://github.com/langchain-ai/langchainjs",
    {
      branch: "main",
      recursive: false,
      unknown: "warn",
      ignorePaths: ["yarn.lock", "*.md"],
    }
  );
  const documents = await loader.load();
  expect(
    documents.filter((document) => document.metadata.source === "yarn.lock")
      .length
  ).toBe(0);
  expect(
    documents.filter((document) => document.metadata.source.endsWith(".md"))
      .length
  ).toBe(0);
  console.log(documents[0].pageContent);
});

test("Test streaming documents from GithubRepoLoader", async () => {
  const loader = new GithubRepoLoader(
    "https://github.com/langchain-ai/langchainjs",
    {
      branch: "main",
      recursive: false,
      unknown: "warn",
    }
  );

  const documents = [];
  for await (const document of loader.loadAsStream()) {
    documents.push(document);
  }

  expect(
    documents.filter((document) => document.metadata.source === "yarn.lock")
      .length
  ).toBe(1);
  expect(
    documents.filter((document) => document.metadata.source === "README.md")
      .length
  ).toBe(1);
});

test("Test ignorePaths streaming with GithubRepoLoader", async () => {
  const loader = new GithubRepoLoader(
    "https://github.com/langchain-ai/langchainjs",
    {
      branch: "main",
      recursive: false,
      unknown: "warn",
      ignorePaths: ["yarn.lock", "*.md"],
    }
  );

  const documents = [];
  for await (const document of loader.loadAsStream()) {
    documents.push(document);
  }

  expect(
    documents.filter((document) => document.metadata.source === "yarn.lock")
      .length
  ).toBe(0);
  expect(
    documents.filter((document) => document.metadata.source.endsWith(".md"))
      .length
  ).toBe(0);
});

test("Test ignoreFiles streaming with GithubRepoLoader", async () => {
  const loader = new GithubRepoLoader(
    "https://github.com/langchain-ai/langchainjs",
    {
      branch: "main",
      recursive: false,
      unknown: "warn",
      ignoreFiles: ["yarn.lock", "README.md"],
    }
  );

  const documents = [];
  for await (const document of loader.loadAsStream()) {
    documents.push(document);
  }

  expect(
    documents.filter((document) => document.metadata.source === "yarn.lock")
      .length
  ).toBe(0);
  expect(
    documents.filter((document) => document.metadata.source === "README.md")
      .length
  ).toBe(0);
});
