import { createServer } from "node:http";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { z } from "zod";

const handler = createMcpHandler(
  () => {
    const server = new McpServer({ name: "modern-example", version: "1.0.0" });
    server.registerTool(
      "echo",
      { inputSchema: z.object({ message: z.string() }) },
      ({ message }) => ({ content: [{ type: "text", text: message }] })
    );
    return server;
  },
  { legacy: "reject" }
);

const http = createServer(toNodeHandler(handler));
http.listen(3001, "127.0.0.1", () => {
  console.log("Modern MCP server: http://127.0.0.1:3001/mcp");
});

process.once("SIGINT", () => http.close());
process.once("SIGTERM", () => http.close());
