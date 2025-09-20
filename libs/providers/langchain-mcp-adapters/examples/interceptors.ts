/**
 * Basic example showing how to use beforeToolCall and afterToolCall hooks
 * with the MultiServerMCPClient.
 *
 * This example connects to the official Filesystem MCP server over stdio,
 * then demonstrates:
 * - beforeToolCall: modifying tool arguments prior to invocation
 * - afterToolCall: modifying the tool result after invocation
 */
import { MultiServerMCPClient } from "../src/index.js";

// Create MCP client with global interceptors
const client = new MultiServerMCPClient({
  mcpServers: {
    filesystem: {
      transport: "stdio" as const,
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "./"],
    },
  },
  // Global hook runs before every tool call. Here we add default args for list_directory
  beforeToolCall: ({ name, args }) => {
    if (name.includes("list_directory")) {
      return {
        args: {
          ...(args as Record<string, unknown>),
          // If caller didn't specify a path, default to the test dir
          path: (args as Record<string, unknown>)?.path,
        },
      };
    }
    return {};
  },
  // Global hook runs after every tool call. Here we override the result shape
  // to something easy to print so you can see the hook in action.
  afterToolCall: ({ name, result }) => {
    if (name.includes("list_directory")) {
      // Replace the text/content part, keep artifacts unchanged
      return { result: ["(modified by afterToolCall)", result[1]] };
    }
    // Return nothing for other tools
    return;
  },
});

try {
  console.log("Initializing MCP client and discovering tools...");
  const tools = await client.getTools();

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
