import { expect, describe, test, beforeEach, afterEach } from "@jest/globals";
import { Stagehand } from "@browserbasehq/stagehand";
import { StagehandToolkit } from "../stagehand.js";
import { z } from "zod";

describe("StagehandToolkit Integration Tests", () => {
  let stagehand: Stagehand;
  let toolkit: StagehandToolkit;

  beforeEach(async () => {
    stagehand = new Stagehand({
      env: "LOCAL",
      headless: false,
      verbose: 2,
      debugDom: true,
      enableCaching: false
    });
    await stagehand.init({ modelName: "claude-3-5-sonnet-20241022" });
    toolkit = await StagehandToolkit.fromStagehand(stagehand);
  });

  afterEach(async () => {
    await stagehand.context.close().catch(() => {});
  });

  test("should perform basic navigation and search", async () => {

    const navigateTool = toolkit.tools.find(t => t.name === "stagehand_navigate");
    await navigateTool.call("https://www.google.com");
    
    const actionTool = toolkit.tools.find(t => t.name === "stagehand_act");
    const result = await actionTool.call('Search for "OpenAI"');

    const currentUrl = await stagehand.page.url();
    expect(currentUrl).toContain("google.com/search?q=OpenAI");
  });

  test("should extract structured data from webpage", async () => {
    await stagehand.page.goto("https://github.com/facebook/react");

    const extractTool = toolkit.tools.find(t => t.name === "stagehand_extract");
    const result = await extractTool.call(JSON.stringify({
      instruction: "Extract the number of stars for the project",
      schema: {
        stars: z.number().describe("the number of stars for the project"),
      }
    }));
    console.log("RESULT");
    console.log(result);

    const { stars } = JSON.parse(result);
    expect(stars).toBeGreaterThan(0);
    expect(typeof stars).toBe("number");
  });

  // test("should handle form interactions", async () => {
  //   await stagehand.page.goto("https://www.google.com/");
    
  //   const actionTool = toolkit.tools.find(t => t.name === "stagehand_act");
    
  //   await actionTool.call("click on the about page");
  //   await actionTool.call("click on the careers page");
  //   await actionTool.call("input data scientist into role");
  //   await actionTool.call("input new york city into location");
    
  //   const currentUrl = await stagehand.page.url();
  //   expect(currentUrl).toContain("careers.google.com");
  // });

  // test("should handle complex navigation flows", async () => {
  //   await stagehand.page.goto("https://arxiv.org/search/");

  //   const actionTool = toolkit.tools.find(t => t.name === "stagehand_act");
  //   const extractTool = toolkit.tools.find(t => t.name === "stagehand_extract");

  //   await actionTool.call("search for the recent papers about web agents");

  //   const result = await extractTool.call(JSON.stringify({
  //     instruction: "extract the titles and links for two papers",
  //     schema: {
  //       papers: {
  //         type: "array",
  //         items: {
  //           type: "object",
  //           properties: {
  //             title: { type: "string" },
  //             link: { type: ["string", "null"] }
  //           },
  //           required: ["title", "link"]
  //         }
  //       }
  //     }
  //   }));

  //   const { papers } = JSON.parse(result);
  //   expect(papers).toHaveLength(2);
  //   expect(papers[0].title).toBeTruthy();
  // });

  // test("should handle error cases gracefully", async () => {
  //   await stagehand.page.goto("https://www.homedepot.com/");

  //   const actionTool = toolkit.tools.find(t => t.name === "stagehand_act");
  //   const result = await actionTool.call("click on the first banana");

  //   expect(JSON.parse(result)).toEqual({
  //     success: false,
  //     message: "Action not found on the current page after checking all chunks.",
  //     action: "click on the first banana"
  //   });
  // });

  // test("should use observe tool to get page information", async () => {
  //   await stagehand.page.goto("https://github.com/browserbase/stagehand");
    
  //   const observeTool = toolkit.tools.find(t => t.name === "stagehand_observe");
  //   const result = await observeTool.call("What actions can be performed on the repository page?");
    
  //   const observations = JSON.parse(result);
  //   expect(observations).toHaveProperty("actions");
  //   expect(Array.isArray(observations.actions)).toBe(true);
  //   expect(observations.actions.length).toBeGreaterThan(0);
  // });

  // test("should handle multiple tools in sequence", async () => {
  //   await stagehand.page.goto("https://github.com/browserbase/stagehand");
    
  //   const observeTool = toolkit.tools.find(t => t.name === "stagehand_observe");
  //   const actionTool = toolkit.tools.find(t => t.name === "stagehand_act");
  //   const extractTool = toolkit.tools.find(t => t.name === "stagehand_extract");

  //   // First observe the page
  //   const observations = await observeTool.call("");
  //   expect(JSON.parse(observations)).toHaveProperty("actions");

  //   // Then perform an action
  //   await actionTool.call("click on the Issues tab");

  //   // Finally extract some data
  //   const result = await extractTool.call(JSON.stringify({
  //     instruction: "Extract the number of open issues",
  //     schema: {
  //       openIssues: { type: "number", description: "number of open issues" }
  //     }
  //   }));

  //   const { openIssues } = JSON.parse(result);
  //   expect(typeof openIssues).toBe("number");
  // });

  // test("should handle tool callbacks", async () => {
  //   const calls: string[] = [];
  //   const handleToolStart = jest.fn(() => {
  //     calls.push("tool start");
  //   });
  //   const handleToolEnd = jest.fn(() => {
  //     calls.push("tool end");
  //   });

  //   await stagehand.page.goto("https://www.google.com");
    
  //   const actionTool = toolkit.tools.find(t => t.name === "stagehand_act");
  //   await actionTool.call('Search for "OpenAI"', {
  //     callbacks: [
  //       {
  //         handleToolStart,
  //         handleToolEnd,
  //       },
  //     ],
  //   });

  //   expect(handleToolStart).toBeCalledTimes(1);
  //   expect(handleToolEnd).toBeCalledTimes(1);
  //   expect(calls).toEqual([
  //     "tool start",
  //     "tool end",
  //   ]);
  // });

  
});
