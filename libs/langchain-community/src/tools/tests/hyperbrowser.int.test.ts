import { test } from "@jest/globals";
import {
  HyperbrowserScrapingTool,
  HyperbrowserExtractTool,
  HyperbrowserCrawlTool,
  HyperbrowserBrowserUseTool,
  HyperbrowserClaudeComputerUseTool,
  HyperbrowserOpenAIComputerUseTool,
} from "../hyperbrowser.js";

test.skip("HyperbrowserScrapingTool", async () => {
  const tool = new HyperbrowserScrapingTool();
  const result = await tool.invoke({
    url: "https://example.com",
    scrapeOptions: {
      formats: ["markdown"],
    },
    sessionOptions: {
      useProxy: false,
      solveCaptchas: false,
    },
  });
  expect(result.data).toBeTruthy();
  expect(result.error).toBeFalsy();
});

test.skip("HyperbrowserExtractTool", async () => {
  const tool = new HyperbrowserExtractTool();
  const result = await tool.invoke({
    url: "https://example.com",
    extractOptions: {
      prompt: "Extract the main heading and first paragraph",
      schema: {
        type: "object",
        properties: {
          heading: { type: "string" },
          firstParagraph: { type: "string" },
        },
      },
    },
  });
  expect(result.data).toBeTruthy();
  expect(result.error).toBeFalsy();
});

test.skip("HyperbrowserCrawlTool", async () => {
  const tool = new HyperbrowserCrawlTool();
  const result = await tool.invoke({
    url: "https://example.com",
    maxPages: 1,
    scrapeOptions: {
      formats: ["markdown"],
    },
    sessionOptions: {
      useProxy: false,
      solveCaptchas: false,
    },
  });
  expect(result.data).toBeTruthy();
  expect(result.error).toBeFalsy();
});

test.skip("HyperbrowserBrowserUseTool", async () => {
  const tool = new HyperbrowserBrowserUseTool();
  const result = await tool.invoke({
    task: "Navigate to example.com and summarize the page. Do absolutely nothing else.",
    maxSteps: 3,
    sessionOptions: {
      useProxy: false,
      solveCaptchas: false,
    },
  });
  expect(result.data).toBeTruthy();
  expect(result.error).toBeFalsy();
});

test.skip("HyperbrowserClaudeComputerUseTool", async () => {
  const tool = new HyperbrowserClaudeComputerUseTool();
  const result = await tool.invoke({
    task: "Navigate to example.com and summarize the page. Do absolutely nothing else.",
    maxSteps: 3,
    sessionOptions: {
      useProxy: false,
      solveCaptchas: false,
    },
  });
  expect(result.data).toBeTruthy();
  expect(result.error).toBeFalsy();
});

test.skip("HyperbrowserOpenAIComputerUseTool", async () => {
  const tool = new HyperbrowserOpenAIComputerUseTool();
  const result = await tool.invoke({
    task: "Navigate to example.com and summarize the page. Do absolutely nothing else.",
    maxSteps: 3,
    sessionOptions: {
      useProxy: false,
      solveCaptchas: false,
    },
  });
  expect(result.data).toBeTruthy();
  expect(result.error).toBeFalsy();
});
