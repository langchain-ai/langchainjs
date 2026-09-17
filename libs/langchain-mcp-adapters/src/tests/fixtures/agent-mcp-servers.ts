import { once } from "node:events";
import { createServer } from "node:http";

import { toNodeHandler } from "@modelcontextprotocol/node";
import {
  createMcpHandler,
  inputRequired,
  McpServer,
} from "@modelcontextprotocol/server";
import { z } from "zod";

export type ElicitationAction = "accept" | "decline" | "cancel";

type ElicitationAnswer = {
  action: ElicitationAction;
};

type AgentMcpCall =
  | { tool: "echo"; label: string }
  | {
      tool: "ask";
      label: string;
      round: number;
      action?: ElicitationAction;
    };

type Completion = {
  label: string;
  action: ElicitationAction;
};

export type AgentMcpServer = {
  url: string;
  calls: AgentMcpCall[];
  echoes: string[];
  authorizations: string[];
  accepted: string[];
  completed: Completion[];
  close(): Promise<void>;
};

export async function startAgentMcpServer(): Promise<AgentMcpServer> {
  const calls: AgentMcpCall[] = [];
  const echoes: string[] = [];
  const authorizations: string[] = [];
  const accepted: string[] = [];
  const completed: Completion[] = [];
  const authorized = new Set<string>();
  let url = "";

  const handler = createMcpHandler(
    () => {
      const server = new McpServer(
        { name: "agent-integration", version: "1" },
        { requestState: { verify: async (state) => state } }
      );

      server.registerTool(
        "echo",
        { inputSchema: z.object({ label: z.string() }) },
        ({ label }) => {
          calls.push({ tool: "echo", label });
          echoes.push(label);

          return {
            content: [{ type: "text", text: `echo:${label}` }],
            structuredContent: { label },
          };
        }
      );

      server.registerTool(
        "ask",
        {
          inputSchema: z.object({
            label: z.string(),
            kind: z.enum(["form", "url"]).default("form"),
            rounds: z.number().int().min(1).max(2).default(1),
          }),
        },
        ({ label, kind, rounds }, context) => {
          const answer = context.mcpReq.inputResponses?.confirmation as
            | ElicitationAnswer
            | undefined;
          const state = context.mcpReq.requestState();
          const round =
            typeof state === "string" && state.startsWith(`${label}:`)
              ? Number(state.slice(label.length + 1))
              : 0;

          calls.push({
            tool: "ask",
            label,
            round,
            ...(answer ? { action: answer.action } : {}),
          });

          if (!answer || (answer.action === "accept" && round < rounds)) {
            return inputRequired({
              requestState: `${label}:${round + 1}`,
              inputRequests: {
                confirmation:
                  kind === "url"
                    ? inputRequired.elicitUrl({
                        message: label,
                        url: `${url}/authorize?label=${encodeURIComponent(label)}`,
                      })
                    : inputRequired.elicit({
                        message: label,
                        requestedSchema: {
                          type: "object",
                          properties: { confirm: { type: "boolean" } },
                          required: ["confirm"],
                        },
                      }),
              },
            });
          }

          if (
            kind === "url" &&
            answer.action === "accept" &&
            !authorized.has(label)
          ) {
            throw new Error(
              "URL elicitation must be completed before acceptance"
            );
          }

          completed.push({ label, action: answer.action });
          if (answer.action === "accept") {
            accepted.push(label);
          }

          return {
            content: [{ type: "text", text: `${label}:${answer.action}` }],
            structuredContent: { label, action: answer.action },
          };
        }
      );

      return server;
    },
    { legacy: "reject" }
  );

  const http = createServer(
    toNodeHandler({
      fetch: async (request) => {
        const requestUrl = new URL(request.url);

        if (requestUrl.pathname === "/authorize") {
          const label = requestUrl.searchParams.get("label");
          if (!label) {
            return new Response("missing label", { status: 400 });
          }

          authorized.add(label);
          authorizations.push(label);
          return new Response("authorized");
        }

        return handler.fetch(request);
      },
    })
  );

  http.listen(0, "127.0.0.1");
  await once(http, "listening");
  const address = http.address();

  if (!address || typeof address === "string") {
    throw new Error("Missing HTTP address");
  }

  url = `http://127.0.0.1:${address.port}`;

  return {
    url,
    calls,
    echoes,
    authorizations,
    accepted,
    completed,
    async close() {
      await handler.close();
      http.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        http.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}
