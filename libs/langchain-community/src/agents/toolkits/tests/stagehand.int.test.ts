import { expect, describe, test, beforeEach, afterEach } from "@jest/globals";
import { Stagehand } from "@browserbasehq/stagehand";
import { StagehandToolkit } from "../stagehand.js";

describe("StagehandToolkit Integration Tests", () => {
  let stagehand: Stagehand;
  let toolkit: StagehandToolkit;

  beforeEach(async () => {
    stagehand = new Stagehand({
      env: "LOCAL",
      headless: false,
      verbose: 2,
      debugDom: true,
      enableCaching: false,
    });
    await stagehand.init({ modelName: "gpt-4o-mini" });
    toolkit = await StagehandToolkit.fromStagehand(stagehand);
  });

  afterEach(async () => {
    await stagehand.context.close().catch(() => {});
  });

  test("should perform basic navigation and search", async () => {
    const navigateTool = toolkit.tools.find(
      (t) => t.name === "stagehand_navigate"
    );
    if (!navigateTool) {
      throw new Error("Navigate tool not found");
    }
    await navigateTool.invoke("https://www.google.com");

    const actionTool = toolkit.tools.find((t) => t.name === "stagehand_act");
    if (!actionTool) {
      throw new Error("Action tool not found"); 
    }
    await actionTool.invoke('Search for "OpenAI"');

    const currentUrl = stagehand.page.url();
    expect(currentUrl).toContain("google.com/search?q=OpenAI");
  });

  // test("should extract structured data from webpage", async () => {
  //   const navigateTool = toolkit.tools.find(
  //     (t) => t.name === "stagehand_navigate"
  //   );
  //   await navigateTool.call(
  //     "https://github.com/facebook/react/graphs/contributors"
  //   );

  //   const extractTool = toolkit.tools.find(
  //     (t) => t.name === "stagehand_extract"
  //   );
  //   const input = {
  //     instruction: "extract the top contributor",
  //     schema: {
  //       type: "object",
  //       properties: {
  //         username: { type: "string" },
  //         url: { type: "string" },
  //       },
  //       required: ["username", "url"],
  //     },
  //   };
  //   const result = await extractTool.call(input); // No need for JSON.stringify
  //   const parsedResult = JSON.parse(result);
  //   const { username, url } = parsedResult;
  //   expect(username).toBeDefined();
  //   expect(url).toBeDefined();
  // });

  // test("should handle form interactions", async () => {
  //   const navigateTool = toolkit.tools.find(
  //     (t) => t.name === "stagehand_navigate"
  //   );
  //   await navigateTool.call("https://www.google.com/");

  //   const actionTool = toolkit.tools.find((t) => t.name === "stagehand_act");

  //   await actionTool.call("click on the about page");
  //   await actionTool.call("click on the careers page");
  //   await actionTool.call("input data scientist into role");
  //   await actionTool.call("input new york city into location");

  //   const currentUrl = await stagehand.page.url();
  //   expect(currentUrl).toContain("google.com/about/careers");
  // });

  // test("should handle error cases gracefully", async () => {
  //   const navigateTool = toolkit.tools.find(
  //     (t) => t.name === "stagehand_navigate"
  //   );
  //   await navigateTool.call("https://www.homedepot.com/");

  //   const actionTool = toolkit.tools.find((t) => t.name === "stagehand_act");
  //   const result = await actionTool.call("click on the first banana");

  //   console.log("RESULT");
  //   console.log(result);

  //   expect(result).toEqual(
  //     "Failed to perform action: Action was not able to be completed."
  //   );
  // });

  // test("should use observe tool to get page information", async () => {
  //   await stagehand.page.goto("https://github.com/browserbase/stagehand");

  //   const observeTool = toolkit.tools.find(
  //     (t) => t.name === "stagehand_observe"
  //   );
  //   const result = await observeTool.call(
  //     "What actions can be performed on the repository page?"
  //   );

  //   const observations = JSON.parse(result);

  //   expect(Array.isArray(observations)).toBe(true);
  //   expect(observations.length).toBeGreaterThan(0);
  //   expect(observations[0]).toHaveProperty("description");
  //   expect(observations[0]).toHaveProperty("selector");
  //   expect(typeof observations[0].description).toBe("string");
  //   expect(typeof observations[0].selector).toBe("string");
  // });

  // test("should perform navigation and search using agent", async () => {
  //   // Import necessary modules
  //   const { ChatOpenAI } = require("@langchain/openai");
  //   const { initializeAgentExecutorWithOptions } = require("langchain/agents");

  //   // Use OpenAI Functions agent to execute the prompt using actions from the Stagehand Toolkit.
  //   const llm = new ChatOpenAI({ temperature: 0 });

  //   const agent = await initializeAgentExecutorWithOptions(
  //     toolkit.tools,
  //     llm,
  //     {
  //       agentType: "openai-functions",
  //       verbose: true,
  //     }
  //   );

  //   // Keep actions atomic
  //   await agent.invoke({
  //     input: `Navigate to https://www.google.com`,
  //   });

  //   await agent.invoke({
  //     input: `Search for "OpenAI"`,
  //   });

  //   // Verify the current URL
  //   const currentUrl = await stagehand.page.url();
  //   expect(currentUrl).toContain("google.com/search?q=OpenAI");
  // });
  
});
