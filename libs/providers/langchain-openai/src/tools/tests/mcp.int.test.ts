import { expect, it, describe } from "vitest";
import {
  HumanMessage,
  AIMessage,
  ContentBlock,
} from "@langchain/core/messages";

import { tools } from "../index.js";
import { ChatOpenAI } from "../../chat_models/index.js";

describe("OpenAI MCP Tool Integration Tests", () => {
  it("mcp connects to a remote MCP server and executes a tool", async () => {
    const llm = new ChatOpenAI({ model: "gpt-4o-mini" });
    const llmWithMcp = llm.bindTools([
      tools.mcp({
        serverLabel: "dmcp",
        serverDescription:
          "A Dungeons and Dragons MCP server to assist with dice rolling.",
        serverUrl: "https://dmcp-server.deno.dev/sse",
        requireApproval: "never",
      }),
    ]);

    const response = await llmWithMcp.invoke([
      new HumanMessage("Roll 2d6+3 for me"),
    ]);

    expect(response).toBeInstanceOf(AIMessage);
    expect(Array.isArray(response.content)).toBe(true);
    expect((response.content[0] as ContentBlock.Text).text).toContain(
      "You rolled a total of"
    );
  });
});
