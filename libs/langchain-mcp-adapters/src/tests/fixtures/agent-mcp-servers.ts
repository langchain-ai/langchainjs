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

type ElicitationAnswer = { action: ElicitationAction };

type AgentMcpCall = {
  label: string;
  /** Which elicitation round of this call the server is serving, from 0. */
  round: number;
  action?: ElicitationAction;
};

type Completion = { label: string; action: ElicitationAction };

export type AgentMcpServer = {
  url: string;
  calls: AgentMcpCall[];
  completed: Completion[];
  close(): Promise<void>;
};

/**
 * A modern HTTP server whose `ask` tool elicits before completing.
 *
 * `interrupts.test.ts` owns the protocol surface — refusals, answer parsing,
 * headers, URL questions, real stdio servers — against its own harness. This
 * one exists for what needs a real agent turn, so it carries only what those
 * tests read: how many rounds to ask for, and what the server saw.
 */
export async function startAgentMcpServer(): Promise<AgentMcpServer> {
  const calls: AgentMcpCall[] = [];
  const completed: Completion[] = [];

  const handler = createMcpHandler(
    () => {
      const server = new McpServer({ name: "agent-integration", version: "1" });

      server.registerTool(
        "ask",
        {
          inputSchema: z.object({
            label: z.string(),
            rounds: z.number().int().min(1).max(2).default(1),
          }),
        },
        ({ label, rounds }, context) => {
          const answer = context.mcpReq.inputResponses?.confirmation as
            | ElicitationAnswer
            | undefined;
          // The round is carried by the continuation the server itself issued.
          const state = context.mcpReq.requestState();
          const round =
            typeof state === "string" && state.startsWith(`${label}:`)
              ? Number(state.slice(label.length + 1))
              : 0;

          calls.push({
            label,
            round,
            ...(answer ? { action: answer.action } : {}),
          });

          if (!answer || (answer.action === "accept" && round < rounds))
            return inputRequired({
              requestState: `${label}:${round + 1}`,
              inputRequests: {
                confirmation: inputRequired.elicit({
                  message: label,
                  requestedSchema: {
                    type: "object",
                    properties: { confirm: { type: "boolean" } },
                    required: ["confirm"],
                  },
                }),
              },
            });

          completed.push({ label, action: answer.action });

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

  const http = createServer(toNodeHandler(handler));
  http.listen(0, "127.0.0.1");
  await once(http, "listening");
  const address = http.address();

  if (!address || typeof address === "string")
    throw new Error("Missing HTTP address");

  return {
    url: `http://127.0.0.1:${address.port}`,
    calls,
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
