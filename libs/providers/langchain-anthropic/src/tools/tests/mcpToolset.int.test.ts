import { expect, it, describe } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { ContentBlock } from "@langchain/core/messages";

import { ChatAnthropic } from "../../chat_models.js";
import { tools } from "../index.js";

const createModel = () =>
  new ChatAnthropic({
    model: "claude-sonnet-4-5-20250929",
    temperature: 0,
  });

describe("Anthropic MCP Toolset Integration Tests", () => {
  it("mcpToolset can connect to MCP server and run a tool", async () => {
    const llm = createModel();

    const mcpToolset = tools.mcpToolset_20251120({
      serverName: "test-server",
    });

    const llmWithTools = llm.bindTools([mcpToolset]);

    const response = await llmWithTools.invoke(
      [
        new HumanMessage(
          "Please use any available tool from the MCP server to demonstrate it works."
        ),
      ],
      {
        mcp_servers: [
          {
            type: "url",
            url: "https://docs.mcp.cloudflare.com/mcp",
            name: "test-server",
          },
        ],
      }
    );

    expect(Array.isArray(response.content)).toBe(true);
    expect(
      (response.content as ContentBlock.Multimodal.Data[]).find(
        (block) => block.type === "mcp_tool_use"
      )
    ).toBeDefined();
    expect(
      (response.content as ContentBlock.Multimodal.Data[]).find(
        (block) => block.type === "mcp_tool_result"
      )
    ).toBeDefined();
  }, 60000);
});
