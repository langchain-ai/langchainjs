import { test, expect, describe } from "@jest/globals";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { SERPGoogleScholarAPITool } from "../google_scholar.js";

describe("SERPGoogleScholarAPITool", () => {
  test("should be setup with correct parameters", async () => {
    const instance = new SERPGoogleScholarAPITool({
      apiKey: getEnvironmentVariable("SERPAPI_API_KEY"),
    });
    expect(instance.name).toBe("serp_google_scholar");
  });

  test("SERPGoogleScholarAPITool returns a string for valid query", async () => {
    const tool = new SERPGoogleScholarAPITool({
      apiKey: getEnvironmentVariable("SERPAPI_API_KEY"),
    });
    const result = await tool.invoke("Artificial Intelligence");
    expect(typeof result).toBe("string");
  });

  test("SERPGoogleScholarAPITool returns non-empty string for valid query", async () => {
    const tool = new SERPGoogleScholarAPITool({
      apiKey: getEnvironmentVariable("SERPAPI_API_KEY"),
    });
    const result = await tool.invoke("Artificial Intelligence");
    expect(result.length).toBeGreaterThan(0);
  });

  test("SERPGoogleScholarAPITool returns 'No results found' for bad query", async () => {
    const tool = new SERPGoogleScholarAPITool({
      apiKey: getEnvironmentVariable("SERPAPI_API_KEY"),
    });
    const result = await tool.invoke("dsalkfjsdlfjasdflasdl");
    expect(result).toBe(
      '"No results found for dsalkfjsdlfjasdflasdl on Google Scholar."'
    );
  });
});
