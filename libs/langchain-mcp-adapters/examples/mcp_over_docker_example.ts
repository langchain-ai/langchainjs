/**
 * Filesystem MCP Server with LangGraph Example
 *
 * This example demonstrates how to use the Filesystem MCP server with LangGraph
 * to create a structured workflow for complex file operations.
 *
 * The graph-based approach allows:
 * 1. Clear separation of responsibilities (reasoning vs execution)
 * 2. Conditional routing based on file operation types
 * 3. Structured handling of complex multi-file operations
 */

/* eslint-disable no-console */
import { MultiServerMCPClient } from "../src/index.js";
import { runExample as runFileSystemExample } from "./filesystem_langgraph_example.js";

async function runExample() {
  const client = new MultiServerMCPClient({
    mcpServers: {
      filesystem: {
        transport: "stdio" as const,
        command: "docker",
        args: [
          "run",
          "-i",
          "--rm",
          "-v",
          "mcp-filesystem-data:/projects",
          "mcp/filesystem",
          "/projects",
        ],
      },
    },
    useStandardContentBlocks: true,
  });

  await runFileSystemExample(client);
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runExample().catch((error) => console.error("Setup error:", error));
}
