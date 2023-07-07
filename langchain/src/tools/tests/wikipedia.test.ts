import { test, expect, describe } from "@jest/globals";
import { WikipediaAPIWrapper } from "../wikipedia.js";

describe("WikipediaAPIWrapper Test suite", () => {
  test("WikipediaAPIWrapperTool", async () => {
    const tool = new WikipediaAPIWrapper();

    const result = await tool.call("What is Langchain?");

    expect(result).toBeDefined();
    expect(result).not.toEqual("");
  });
});
