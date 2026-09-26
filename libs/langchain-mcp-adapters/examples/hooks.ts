/**
 * Basic example showing how to use beforeToolCall and afterToolCall hooks
 * with the MCPAdapter.
 *
 * This example connects to the official Filesystem MCP server over stdio,
 * then demonstrates:
 * - beforeToolCall: modifying tool arguments prior to invocation
 * - afterToolCall: modifying the tool result after invocation
 */
import { MCPAdapter } from "../src/index.js";
import { z } from "zod";

// Create MCP client with global interceptors
const client = new MCPAdapter({
  servers: {
    filesystem: {
      mode: "legacy",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "./"],
    },
  },
  // Parse the application boundary before reading tool arguments.
  beforeToolCall: ({ name, args }) => {
    if (name.includes("list_directory")) {
      const { path } = z.object({ path: z.string() }).parse(args);
      return {
        args: { path },
      };
    }
    return undefined;
  },
  // Global hook runs after every tool call. Here we override the result shape
  // to something easy to print so you can see the hook in action.
  afterToolCall: ({ name, result }) => {
    if (name.includes("list_directory")) {
      // Replace the text/content part, keep artifacts unchanged
      // result[0] contains model-facing LangChain content. result[1] keeps
      // MCP artifacts such as mcp_structured_content, mcp_meta and mcp_content.
      return { result: ["(modified by afterToolCall)", result[1]] };
    }
    // Return nothing for other tools
    return;
  },
});

try {
  console.log("Initializing MCP client and discovering tools...");
  const tools = await client.listTools();

  // Find the filesystem tool we want to demonstrate
  const listDir = tools.find((t) => t.name.includes("list_directory"));
  if (!listDir) {
    throw new Error(
      "Could not find 'list_directory' tool. Is the filesystem server available?"
    );
  }

  console.log(`Calling tool: ${listDir.name}`);
  // Provide required schema arg; hooks can still adjust/augment as needed
  const res = await listDir.invoke({ path: "./" });
  console.log("Tool response (after afterToolCall):", res);
} finally {
  await client.close();
}
