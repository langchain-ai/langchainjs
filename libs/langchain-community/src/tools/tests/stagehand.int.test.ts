import { expect, describe, test, beforeEach, afterEach } from "@jest/globals";
import { StagehandToolkit } from "../stagehand.js";
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";

describe("StagehandToolkit Integration Tests", () => {
  let toolkit: StagehandToolkit;

  beforeEach(async () => {
    toolkit = new StagehandToolkit({
      env: "LOCAL",
      headless: true,
      verbose: 2,
      debugDom: true,
      enableCaching: false
    });
    await toolkit.initialize();
  });

  afterEach(async () => {
    await toolkit.stagehand?.context.close().catch(() => {});
  });

  test("should perform basic navigation and search", async () => {
    const navigateTool = toolkit.getTool("navigate");
    const actionTool = toolkit.getTool("act");
    
    await navigateTool.call("https://www.google.com");
    const result = await actionTool.call('Search for "OpenAI"');

    const currentUrl = await toolkit.stagehand.page.url();
    expect(currentUrl).toContain("google.com/search?q=OpenAI");
  });

  test("should extract structured data from webpage", async () => {
    const navigateTool = toolkit.getTool("navigate");
    const extractTool = toolkit.getTool("extract");

    await navigateTool.call("https://github.com/facebook/react");

    const result = await extractTool.call(JSON.stringify({
      instruction: "Extract the number of stars for the project",
      schema: {
        type: "object",
        properties: {
          stars: {
            type: "number",
            description: "the number of stars for the project"
          }
        },
        required: ["stars"]
      }
    }));

    const { stars } = JSON.parse(result);
    expect(stars).toBeGreaterThan(0);
    expect(typeof stars).toBe("number");
  });

  test("should handle form interactions", async () => {
    const navigateTool = toolkit.getTool("navigate");
    const actionTool = toolkit.getTool("act");
    
    await navigateTool.call("https://www.google.com/");
    
    await actionTool.call("click on the about page");
    await actionTool.call("click on the careers page");
    await actionTool.call("input data scientist into role");
    await actionTool.call("input new york city into location");
    
    const currentUrl = await toolkit.stagehand.page.url();
    expect(currentUrl).toContain("careers.google.com");
  });

  test("should handle complex navigation flows", async () => {
    const navigateTool = toolkit.getTool("navigate");
    const actionTool = toolkit.getTool("act");
    const extractTool = toolkit.getTool("extract");

    await navigateTool.call("https://arxiv.org/search/");
    await actionTool.call("search for the recent papers about web agents");

    const result = await extractTool.call(JSON.stringify({
      instruction: "extract the titles and links for two papers",
      schema: {
        type: "object",
        properties: {
          papers: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                link: { type: ["string", "null"] }
              },
              required: ["title", "link"]
            }
          }
        },
        required: ["papers"]
      }
    }));

    const { papers } = JSON.parse(result);
    expect(papers).toHaveLength(2);
    expect(papers[0].title).toBeTruthy();
  });

  test("should handle error cases gracefully", async () => {
    const navigateTool = toolkit.getTool("navigate");
    const actionTool = toolkit.getTool("act");

    await navigateTool.call("https://www.homedepot.com/");
    const result = await actionTool.call("click on the first banana");

    expect(JSON.parse(result)).toEqual({
      success: false,
      message: "Action not found on the current page after checking all chunks.",
      action: "click on the first banana"
    });
  });
});