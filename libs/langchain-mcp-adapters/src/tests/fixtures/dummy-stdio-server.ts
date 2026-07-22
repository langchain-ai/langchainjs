#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

// Get server name from command line arguments
const serverName = process.argv[2] || "dummy-server";

const server = new McpServer(
  { name: serverName, version: "1.0.0" },
  { capabilities: { logging: {} } }
);

// Add test tools that capture request metadata
server.registerTool(
  "test_tool",
  {
    description: "A test tool that echoes input and metadata",
    inputSchema: z.object({ input: z.string() }),
  },
  async ({ input }, ctx) => {
    // Emit a logging message
    await server.server.notification(
      {
        method: "notifications/message",
        params: {
          level: "info",
          message: `test_tool invoked with ${input}`,
          timestamp: new Date().toISOString(),
        },
      },
      { relatedRequestId: ctx.mcpReq.id }
    );

    // Simulate progress updates using progressToken if present
    const progressToken = ctx.mcpReq._meta?.progressToken;
    if (progressToken !== undefined) {
      const steps = 3;
      for (let i = 1; i <= steps; i++) {
        await server.server.notification(
          {
            method: "notifications/progress",
            params: {
              progress: i,
              total: steps,
              progressToken,
            },
          },
          { relatedRequestId: ctx.mcpReq.id }
        );
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            input,
            meta: ctx.mcpReq._meta,
            serverName,
          }),
        },
      ],
    };
  }
);

// Add a tool that can check environment variables
server.registerTool(
  "check_env",
  {
    description: "Check environment variable",
    inputSchema: z.object({ varName: z.string() }),
  },
  async ({ varName }) => {
    return {
      content: [
        {
          type: "text",
          // oxlint-disable-next-line no-process-env
          text: process.env[varName] || "NOT_SET",
        },
      ],
    };
  }
);

// Connect to stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
