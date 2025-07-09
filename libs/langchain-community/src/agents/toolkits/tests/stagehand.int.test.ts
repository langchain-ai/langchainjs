import { expect, describe, test, beforeEach, afterEach } from "@jest/globals";
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
// import { createReactAgent } from "@langchain/langgraph/prebuilt";
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

  test("should extract structured data from webpage", async () => {
    const navigateTool = toolkit.tools.find(
      (t) => t.name === "stagehand_navigate"
    );
    if (!navigateTool) {
      throw new Error("Navigate tool not found");
    }
    await navigateTool.invoke(
      "https://github.com/facebook/react/graphs/contributors"
    );

    const extractTool = toolkit.tools.find(
      (t) => t.name === "stagehand_extract"
    );
    if (!extractTool) {
      throw new Error("Extract tool not found");
    }
    const input = {
      instruction: "extract the top contributor",
      schema: z.object({
        username: z.string(),
        url: z.string(),
      }),
    };
    const result = await extractTool.invoke(input);
    const parsedResult = JSON.parse(result);
    const { username, url } = parsedResult;
    expect(username).toBeDefined();
    expect(url).toBeDefined();
  });

  test("should handle tab navigation", async () => {
    const navigateTool = toolkit.tools.find(
      (t) => t.name === "stagehand_navigate"
    );
    if (!navigateTool) {
      throw new Error("Navigate tool not found");
    }
    await navigateTool.invoke("https://www.google.com/");

    const actionTool = toolkit.tools.find((t) => t.name === "stagehand_act");
    if (!actionTool) {
      throw new Error("Action tool not found");
    }
    await actionTool.invoke("click on the about page");

    const currentUrl = stagehand.page.url();
    expect(currentUrl).toContain("about");
  });

  test("should use observe tool to get page information", async () => {
    await stagehand.page.goto("https://github.com/browserbase/stagehand");

    const observeTool = toolkit.tools.find(
      (t) => t.name === "stagehand_observe"
    );
    if (!observeTool) {
      throw new Error("Observe tool not found");
    }
    const result = await observeTool.invoke(
      "What actions can be performed on the repository page?"
    );

    const observations = JSON.parse(result);

    expect(Array.isArray(observations)).toBe(true);
    expect(observations.length).toBeGreaterThan(0);
    expect(observations[0]).toHaveProperty("description");
    expect(observations[0]).toHaveProperty("selector");
    expect(typeof observations[0].description).toBe("string");
    expect(typeof observations[0].selector).toBe("string");
  });

  test("should perform navigation and search using llm with tools", async () => {
    const llm = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 });

    if (!llm.bindTools) {
      throw new Error("Language model does not support tools.");
    }

    // Bind tools to the LLM
    const llmWithTools = llm.bindTools(toolkit.tools);

    // Execute queries atomically
    const result = await llmWithTools.invoke(
      "Navigate to https://www.google.com"
    );

    expect(result.tool_calls).toBeDefined();
    expect(result.tool_calls?.length).toBe(1);
    const toolCall = result.tool_calls?.[0];
    expect(toolCall?.name).toBe("stagehand_navigate");

    const navigateTool = toolkit.tools.find(
      (t) => t.name === "stagehand_navigate"
    );
    if (!navigateTool) {
      throw new Error("Navigate tool not found");
    }
    const navigateResult = await navigateTool?.invoke(toolCall?.args?.input);
    expect(navigateResult).toContain("Successfully navigated");

    const result2 = await llmWithTools.invoke('Search for "OpenAI"');
    expect(result2.tool_calls).toBeDefined();
    expect(result2.tool_calls?.length).toBe(1);
    const actionToolCall = result2.tool_calls?.[0];
    expect(actionToolCall?.name).toBe("stagehand_act");
    expect(actionToolCall?.args?.input).toBe("search for OpenAI");

    const actionTool = toolkit.tools.find((t) => t.name === "stagehand_act");
    if (!actionTool) {
      throw new Error("Action tool not found");
    }
    const actionResult = await actionTool.invoke(actionToolCall?.args?.input);
    expect(actionResult).toContain("successfully");

    // Verify the current URL
    const currentUrl = stagehand.page.url();
    expect(currentUrl).toContain("google.com/search?q=OpenAI");
  });

  // test("should work with langgraph", async () => {
  //   const actTool = toolkit.tools.find((t) => t.name === "stagehand_act");
  //   const navigateTool = toolkit.tools.find(
  //     (t) => t.name === "stagehand_navigate"
  //   );
  //   if (!actTool || !navigateTool) {
  //     throw new Error("Required tools not found");
  //   }
  //   const tools = [actTool, navigateTool];

  //   const model = new ChatOpenAI({
  //     modelName: "gpt-4",
  //     temperature: 0,
  //   });

  //   const agent = createReactAgent({
  //     llm: model,
  //     tools,
  //   });
  //   // Navigate to Google
  //   const inputs1 = {
  //     messages: [
  //       {
  //         role: "user",
  //         content: "Navigate to https://www.google.com",
  //       },
  //     ],
  //   };

  //   const stream1 = await agent.stream(inputs1, {
  //     streamMode: "values",
  //   });

  //   for await (const { messages } of stream1) {
  //     const msg =
  //       messages && messages.length > 0
  //         ? messages[messages.length - 1]
  //         : undefined;
  //     if (msg?.content) {
  //       console.log(msg.content);
  //     } else if (msg?.tool_calls && msg.tool_calls.length > 0) {
  //       console.log(msg.tool_calls);
  //     } else {
  //       console.log(msg);
  //     }
  //   }

  //   // Click through to careers page and search
  //   const inputs2 = {
  //     messages: [
  //       {
  //         role: "user",
  //         content: "Click on the About page",
  //       },
  //     ],
  //   };

  //   const stream2 = await agent.stream(inputs2, {
  //     streamMode: "values",
  //   });
  //   for await (const { messages } of stream2) {
  //     const msg = messages ? messages[messages.length - 1] : undefined;
  //     if (msg?.content) {
  //       console.log(msg.content);
  //     } else if (msg?.tool_calls && msg.tool_calls.length > 0) {
  //       console.log(msg.tool_calls);
  //     } else {
  //       console.log(msg);
  //     }
  //   }

  //   const currentUrl = stagehand.page.url();
  //   expect(currentUrl).toContain("about");
  // });
});
