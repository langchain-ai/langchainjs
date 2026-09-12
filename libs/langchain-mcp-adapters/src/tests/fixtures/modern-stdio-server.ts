import { McpServer, inputRequired } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { isSpecType } from "@modelcontextprotocol/client";

serveStdio(
  () => {
    const server = new McpServer({ name: "modern-stdio", version: "2.0.0" });
    server.registerTool(
      "approve",
      { inputSchema: z.object({}) },
      async (_, context) => {
        const answer = context.mcpReq.inputResponses?.confirmation;

        if (!answer) {
          return inputRequired({
            requestState: "stdio-fixture-state",
            inputRequests: {
              confirmation: inputRequired.elicit({
                message: "Approve modern?",
                requestedSchema: {
                  type: "object",
                  properties: { confirm: { type: "boolean" } },
                  required: ["confirm"],
                },
              }),
            },
          });
        }

        if (context.mcpReq.requestState() !== "stdio-fixture-state") {
          throw new Error("Missing continuation state");
        }

        if (!isSpecType.ElicitResult(answer))
          throw new Error("Invalid elicitation answer");

        return { content: [{ type: "text", text: answer.action }] };
      }
    );

    return server;
  },
  { legacy: "reject" }
);
