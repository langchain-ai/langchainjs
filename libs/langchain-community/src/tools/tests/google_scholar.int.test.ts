import { test, expect, describe } from "@jest/globals";
import { GoogleScholarAPI } from "../google_scholar.js";

describe("GoogleScholarAPI", () => {
  test("should be setup with correct parameters", async () => {
    const instance = new GoogleScholarAPI({
      apiKey: process.env.SERPAPI_API_KEY
    });
    expect(instance.name).toBe("google_scholar");
  });

  test("GoogleScholarAPI returns a string for valid query", async () => {
    const tool = new GoogleScholarAPI({
      apiKey: process.env.SERPAPI_API_KEY
    });
    const result = await tool.invoke("Artificial Intelligence");
    expect(typeof result).toBe("string");
  });

  test("GoogleScholarAPI returns non-empty string for valid query", async () => {
    const tool = new GoogleScholarAPI({
      apiKey: process.env.SERPAPI_API_KEY
    });
    const result = await tool.invoke("Artificial Intelligence");
    expect(result.length).toBeGreaterThan(0);
  });

  test("GoogleScholarAPI returns 'No results found' for bad query", async () => {
    const tool = new GoogleScholarAPI({
      apiKey: process.env.SERPAPI_API_KEY
    });
    const result = await tool.invoke("dsalkfjsdlfjasdflasdl");
    expect(result).toBe("\"No results found for dsalkfjsdlfjasdflasdl on Google Scholar.\"");
  });

});
