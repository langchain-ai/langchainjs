import { test, expect } from "@jest/globals";
import Exa from "exa-js";
import { ExaFindSimilarResults, ExaSearchResults } from "../tools.js";

test("ExaSearchResults can perform a search given a string query", async () => {
  const exaTool = new ExaSearchResults<{ text: true }>({
    client: new Exa(),
  });

  const toolData = await exaTool.invoke(
    "What does the AI company LangChain do?"
  );

  const parsedData = JSON.parse(toolData);
  expect("results" in parsedData).toBeTruthy();
  // console.log("results:", parsedData.results);
  expect(parsedData.results.length).toBeGreaterThan(0);
});

test("ExaFindSimilarResults can perform a simalitaty search with a provided URL", async () => {
  const exaTool = new ExaFindSimilarResults<{ text: true }>({
    client: new Exa(),
  });

  const toolData = await exaTool.invoke("https://langchain.com");

  const parsedData = JSON.parse(toolData);
  expect("results" in parsedData).toBeTruthy();
  // console.log("results:", parsedData.results);
  expect(parsedData.results.length).toBeGreaterThan(0);
});
