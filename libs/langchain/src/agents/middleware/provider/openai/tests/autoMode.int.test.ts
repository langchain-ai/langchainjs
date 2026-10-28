import { describe, it, expect } from "vitest";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod/v4";
import { openAIAutoModeMiddleware } from "../autoMode.js";
import { createAgent } from "../../../../index.js";
import { FakeToolCallingModel } from "../../../../tests/utils.js";

describe("openAIAutoModeMiddleware", () => {
  it.each([
    {
      request: "Rename /workspace/draft.txt to /workspace/final.txt.",
      name: "move_file",
      args: {
        source: "/workspace/draft.txt",
        destination: "/workspace/final.txt",
      },
      status: "success",
    },
    {
      request: "Summarize /workspace/report.txt for me.",
      name: "delete_file",
      args: { source: "/workspace/report.txt" },
      status: "error",
    },
  ])(
    "gates $name with a live classification",
    async ({ request, name, args, status }) => {
      const executions: string[] = [];
      const moveFile = tool(
        async ({ source }) => {
          executions.push(source);
          return "moved";
        },
        {
          name: "move_file",
          description: "Move a file from source to destination.",
          schema: z.object({ source: z.string(), destination: z.string() }),
        }
      );
      const deleteFile = tool(
        async ({ source }) => {
          executions.push(source);
          return "deleted";
        },
        {
          name: "delete_file",
          description: "Delete a file at the supplied path.",
          schema: z.object({ source: z.string() }),
        }
      );
      const tools = [moveFile, deleteFile];
      const agent = createAgent({
        model: new FakeToolCallingModel({
          toolCalls: [[{ id: "call_live", name, args }], []],
        }),
        tools,
        middleware: [openAIAutoModeMiddleware({ model: "gpt-6-luna", tools })],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage(request)],
      });

      const toolMessage = result.messages.find((message) =>
        ToolMessage.isInstance(message)
      ) as ToolMessage;
      expect(toolMessage.status ?? "success").toBe(status);
      expect(executions.length > 0).toBe(status === "success");
    }
  );
});
