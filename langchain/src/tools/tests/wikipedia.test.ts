import { test, expect } from "@jest/globals";
import { WikipediaAPIWrapper } from "../wikipedia.js";

test("WikipediaAPIWrapperTool returns a string for valid query", async () => {
  const tool = new WikipediaAPIWrapper();
  const result = await tool.call("Langchain");
  expect(typeof result).toBe("string");
});

test("WikipediaAPIWrapperTool returns non-empty string for valid query", async () => {
  const tool = new WikipediaAPIWrapper();
  const result = await tool.call("Langchain");
  expect(result).not.toBe("");
});

test("WikipediaAPIWrapperTool returns 'No good Wikipedia Search Result was found' for bad query", async () => {
  const tool = new WikipediaAPIWrapper();
  const result = await tool.call("kjdsfklfjskladjflkdsajflkadsjf");
  expect(result).toBe("No good Wikipedia Search Result was found");
});
