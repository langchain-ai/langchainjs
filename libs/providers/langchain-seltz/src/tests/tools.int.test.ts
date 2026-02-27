import { test, expect } from "vitest";
import { Seltz } from "seltz";
import { SeltzSearchResults } from "../tools.js";

test("SeltzSearchResults can perform a search given a string query", async () => {
  const seltzTool = new SeltzSearchResults({
    client: new Seltz(),
  });

  const toolData = await seltzTool.invoke(
    "What does the AI company LangChain do?"
  );

  const parsedData = JSON.parse(toolData);
  expect("documents" in parsedData).toBeTruthy();
  expect(parsedData.documents.length).toBeGreaterThan(0);
});

test("SeltzSearchResults can perform a search with options", async () => {
  const seltzTool = new SeltzSearchResults({
    client: new Seltz(),
    searchArgs: {
      maxDocuments: 3,
      context: "Looking for information about AI frameworks",
    },
  });

  const toolData = await seltzTool.invoke(
    "What does the AI company LangChain do?"
  );

  const parsedData = JSON.parse(toolData);
  expect("documents" in parsedData).toBeTruthy();
  expect(parsedData.documents.length).toBeGreaterThan(0);
});
