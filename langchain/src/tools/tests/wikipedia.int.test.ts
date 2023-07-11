import { test, expect } from "@jest/globals";
import { WikipediaAPI } from "../wikipedia.js";

test("WikipediaAPITool returns a string for valid query", async () => {
  const tool = new WikipediaAPI();
  const result = await tool.call("Langchain");
  expect(typeof result).toBe("string");
});

test("WikipediaAPITool returns non-empty string for valid query", async () => {
  const tool = new WikipediaAPI();
  const result = await tool.call("Langchain");
  console.log(result);
  expect(result).not.toBe("");
});

test("WikipediaAPITool returns 'No good Wikipedia Search Result was found' for bad query", async () => {
  const tool = new WikipediaAPI();
  const result = await tool.call("kjdsfklfjskladjflkdsajflkadsjf");
  console.log(result);
  expect(result).toBe("No good Wikipedia Search Result was found");
});
