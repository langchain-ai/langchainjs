/**
 * Simple example showing how to listen for log events and progress updates
 * using @modelcontextprotocol/server-everything with MultiServerMCPClient.
 */

import { MultiServerMCPClient } from "../src/index.js";

// Create an MCP client that starts the Everything server over stdio
const client = new MultiServerMCPClient({
  mcpServers: {
    everything: {
      transport: "stdio" as const,
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-everything"],
    },
  },
  onLog: (log) => {
    console.log(`[LOG] ${log.params.data}`);
  },
  onProgress: (p) => {
    console.log(`[PROGRESS] ${(p.progress / (p.total ?? 1)) * 100}%`);
  },
});

try {
  console.log(
    "Connecting to @modelcontextprotocol/server-everything and discovering tools..."
  );
  const tools = await client.getTools();
  console.log(`Loaded ${tools.length} tools`);

  if (tools.length === 0) {
    throw new Error("No tools found from server-everything");
  }

  const longRunningOperation = tools.find((t) =>
    t.name.includes("longRunningOperation")
  );
  const result = await longRunningOperation?.invoke({
    steps: 10,
    duration: 1,
  });
  console.log("Tool result:", result);
} finally {
  await client.close();
}
