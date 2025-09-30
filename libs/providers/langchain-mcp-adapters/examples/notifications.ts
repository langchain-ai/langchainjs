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

  // Receive log/notification messages from the server
  onMessage: (log, source) => {
    console.log(`[${source.server}] ${log.data}`);
  },

  // Receive progress updates (e.g. from long‑running tool calls)
  onProgress: (progress, source) => {
    const pct =
      progress.percentage ??
      (progress.progress != null && progress.total
        ? Math.round((progress.progress / progress.total) * 100)
        : undefined);
    if (pct != null) {
      const origin =
        source.type === "tool" ? `${source.server}/${source.name}` : "unknown";
      console.log(`[progress:${origin}] ${pct}%`);
    }
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
