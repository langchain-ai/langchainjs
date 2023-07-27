import { test, expect } from "@jest/globals";
import { WikipediaQueryRun } from "../wikipedia_query_run.js";

test.skip("WikipediaQueryRunTool returns a string for valid query", async () => {
  const tool = new WikipediaQueryRun();
  const result = await tool.call("Langchain");
  expect(typeof result).toBe("string");
});

test.skip("WikipediaQueryRunTool returns non-empty string for valid query", async () => {
  const tool = new WikipediaQueryRun();
  const result = await tool.call("Langchain");
  console.log(result);
  expect(result).not.toBe("");
});

test.skip("WikipediaQueryRunTool returns 'No good Wikipedia Search Result was found' for bad query", async () => {
  const tool = new WikipediaQueryRun();
  const result = await tool.call("kjdsfklfjskladjflkdsajflkadsjf");
  console.log(result);
  expect(result).toBe("No good Wikipedia Search Result was found");
});
