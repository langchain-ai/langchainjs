import { test, expect } from "@jest/globals";
import { Serpex } from "../serpex.js";

// Mock API key for testing
const MOCK_API_KEY = "sk_a002b8bf71992a04cb58c0896b906808ffcdea5b939269dec74b718e846259a9";

test("Serpex can be instantiated with API key", () => {
  const serpex = new Serpex(MOCK_API_KEY);
  expect(serpex).toBeDefined();
  expect(serpex.name).toBe("serpex_search");
});

test("Serpex throws error without API key", () => {
  expect(() => new Serpex(undefined)).toThrow(
    "SERPEX API key is required"
  );
});

test("Serpex can be instantiated with custom parameters", () => {
  const serpex = new Serpex(MOCK_API_KEY, {
    engine: "google",
    category: "web",
    time_range: "day",
  });
  expect(serpex).toBeDefined();
});

test("Serpex buildUrl creates correct URL with default params", () => {
  const serpex = new Serpex(MOCK_API_KEY);
  const url = (serpex as any).buildUrl("test query");
  
  expect(url).toContain("api.serpex.com/api/search");
  expect(url).toContain("q=test+query");
  expect(url).toContain("engine=auto");
  expect(url).toContain("category=web");
});

test("Serpex buildUrl creates correct URL with custom params", () => {
  const serpex = new Serpex(MOCK_API_KEY, {
    engine: "google",
    time_range: "week",
  });
  const url = (serpex as any).buildUrl("AI news");
  
  expect(url).toContain("q=AI+news");
  expect(url).toContain("engine=google");
  expect(url).toContain("time_range=week");
});

test("Serpex can use custom base URL", () => {
  const customBaseURL = "https://api.serpex.dev";
  const serpex = new Serpex(MOCK_API_KEY, {}, customBaseURL);
  const url = (serpex as any).buildUrl("test");
  
  expect(url).toContain(customBaseURL);
});

// Integration test (commented out - requires real API key)
/*
test("Serpex performs real search", async () => {
  const apiKey = process.env.SERPEX_API_KEY;
  if (!apiKey) {
    console.log("Skipping integration test: SERPEX_API_KEY not set");
    return;
  }

  const serpex = new Serpex(apiKey, {
    engine: "auto",
    category: "web",
  });

  const result = await serpex._call("weather in San Francisco");
  
  expect(result).toBeTruthy();
  expect(result).not.toContain("Error");
  expect(result.length).toBeGreaterThan(0);
}, 30000);
*/
