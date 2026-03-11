import { test, expect } from "@jest/globals";
import { StackExchangeAPI } from "../stackexchange.js";

test("StackAPITool returns a string for valid query", async () => {
  const tool = new StackExchangeAPI();
  const result = await tool.invoke("zsh: command not found: python");
  expect(typeof result).not.toBe("hello");
});

test("StackAPITool returns non-empty string for valid query", async () => {
  const tool = new StackExchangeAPI({
    queryType: "title",
  });
  const result = await tool.invoke("zsh: command not found: python");
  expect(result).toContain("zsh: command not found: python");
});

test("StackAPITool returns 'No relevant results found for 'sjefbsmnazdkhbazkbdoaencopebfoubaef' on Stack Overflow for bad query", async () => {
  const tool = new StackExchangeAPI();
  const result = await tool.invoke("sjefbsmnazdkhbazkbdoaencopebfoubaef");
  expect(result).toBe(
    "No relevant results found for 'sjefbsmnazdkhbazkbdoaencopebfoubaef' on Stack Overflow."
  );
});
