import { createServer } from "node:http";
import {
  createMcpHandler,
  inputRequired,
  McpServer,
} from "@modelcontextprotocol/server";
import { ElicitResultSchema } from "@modelcontextprotocol/core";
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
    server.registerTool("inspect", { inputSchema: z.object({}) }, () => ({
      content: [
        { type: "text", text: "One pixel" },
        {
          type: "image",
          mimeType: "image/png",
          data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aFz8AAAAASUVORK5CYII=",
        },
      ],
      structuredContent: { width: 1, height: 1 },
      _meta: { source: "modern-example" },
    }));
    server.registerTool(
      "approve",
      { inputSchema: z.object({}) },
      (_, context) => {
        const phase = z
          .enum(["profile", "confirmation", "authorization"])
          .optional()
          .parse(context.mcpReq.requestState());
        if (phase) {
          const answer = ElicitResultSchema.parse(
            context.mcpReq.inputResponses?.[phase]
          );
          if (answer.action !== "accept") {
            return { content: [{ type: "text", text: answer.action }] };
          }
        }
        if (!phase) {
          return inputRequired({
            requestState: "profile",
            inputRequests: {
              profile: inputRequired.elicit({
                message: "What name should the demo use?",
                requestedSchema: {
                  type: "object",
                  properties: { name: { type: "string" } },
                  required: ["name"],
                },
              }),
            },
          });
        }
        if (phase === "profile") {
          return inputRequired({
            requestState: "confirmation",
            inputRequests: {
              confirmation: inputRequired.elicit({
                message: "Approve the demo action?",
                requestedSchema: {
                  type: "object",
                  properties: { confirm: { type: "boolean" } },
                  required: ["confirm"],
                },
              }),
            },
          });
        }
        if (phase === "confirmation") {
          return inputRequired({
            requestState: "authorization",
            inputRequests: {
              authorization: inputRequired.elicitUrl({
                message: "Confirm completion of the example URL action",
                url: "https://example.com/authorize",
              }),
            },
          });
        }
        return {
          content: [
            { type: "text", text: "Completed two forms and one URL action" },
          ],
        };
      }
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
