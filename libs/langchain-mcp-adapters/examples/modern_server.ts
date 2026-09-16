import { once } from "node:events";
import { createServer } from "node:http";
import {
  createMcpHandler,
  createRequestStateCodec,
  inputRequired,
  McpServer,
} from "@modelcontextprotocol/server";
import { ElicitResultSchema } from "@modelcontextprotocol/core";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { z } from "zod";

const approvalPhaseSchema = z.enum([
  "profile",
  "confirmation",
  "authorization",
]);
type ApprovalPhase = z.infer<typeof approvalPhaseSchema>;

// This local demo is single-process, so one ephemeral key can verify every
// retry. Production applications must provide a shared stable key and bind
// request state to their authenticated principal as well as the method.
const requestStateCodec = createRequestStateCodec<{ phase: ApprovalPhase }>({
  key: crypto.getRandomValues(new Uint8Array(32)),
  bind: (context) => context.mcpReq.method,
});

const handler = createMcpHandler(
  () => {
    const server = new McpServer(
      { name: "modern-example", version: "1.0.0" },
      { requestState: { verify: requestStateCodec.verify } }
    );
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
      async (_, context) => {
        const phase = context.mcpReq.requestState<{ phase: ApprovalPhase }>()
          ?.phase;
        if (!phase) {
          return inputRequired({
            requestState: await requestStateCodec.mint(
              { phase: "profile" },
              context
            ),
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

        const answer = ElicitResultSchema.parse(
          context.mcpReq.inputResponses?.[phase]
        );
        if (answer.action !== "accept") {
          return { content: [{ type: "text", text: answer.action }] };
        }

        if (phase === "profile") {
          z.object({ name: z.string() }).parse(answer.content);
          return inputRequired({
            requestState: await requestStateCodec.mint(
              { phase: "confirmation" },
              context
            ),
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
          const confirmation = z
            .object({ confirm: z.boolean() })
            .parse(answer.content);
          if (!confirmation.confirm) {
            return { content: [{ type: "text", text: "decline" }] };
          }
          return inputRequired({
            requestState: await requestStateCodec.mint(
              { phase: "authorization" },
              context
            ),
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

export function createModernServer() {
  return createServer(toNodeHandler(handler));
}

export async function listenModernServer(port = 3001) {
  const http = createModernServer();
  http.listen(port, "127.0.0.1");
  await once(http, "listening");
  return http;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  listenModernServer().then(
    (http) => {
      console.log("Modern MCP server: http://127.0.0.1:3001/mcp");
      const close = () => {
        http.close();
        http.closeAllConnections();
      };
      process.once("SIGINT", close);
      process.once("SIGTERM", close);
    },
    (error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    }
  );
}
