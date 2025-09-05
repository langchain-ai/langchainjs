import { z } from "zod";
import { v4 as uuid } from "uuid";
import { AIMessage, ToolMessage } from "@langchain/core/messages";
import { interrupt } from "@langchain/langgraph";
import { createMiddleware } from "../middleware.js";
import type { ToolCall } from "../types.js";

import { HumanResponse } from "langchain";

/**
 * Interrupt request for tool approval
 */
interface ToolApprovalRequest {
  action: string;
  args: Record<string, any>;
  toolCallId: string;
  description?: string;
}

const contextSchema = z.object({
  toolConfigs: z
    .record(
      z.object({
        requireApproval: z.boolean().optional(),
        description: z.string().optional(),
      })
    )
    .default({}),
  messagePrefix: z.string().default("Tool execution requires approval"),
});

/**
 * Human-in-the-Loop middleware for tool approval
 *
 * This middleware intercepts tool calls and allows human approval/editing
 * before execution. It supports:
 * - Selective tool approval based on configuration
 * - Editing tool arguments before execution
 * - Skipping tool execution entirely
 * - Providing manual responses instead of tool execution
 *
 * @param options Configuration options
 * @returns Middleware instance
 *
 * @example
 * ```ts
 * const hitlMiddleware = humanInTheLoopMiddleware({
 *   toolConfigs: {
 *     "dangerous_tool": { requireApproval: true },
 *     "safe_tool": { requireApproval: false }
 *   }
 * });
 * ```
 */
export function humanInTheLoopMiddleware(
  options: z.input<typeof contextSchema> = {}
) {
  return createMiddleware({
    name: "HumanInTheLoopMiddleware",
    contextSchema,
    afterModel: async (state, runtime, controls) => {
      const config = { ...contextSchema.parse(options), ...runtime.context };
      const messages = state.messages;

      if (!messages.length) {
        return;
      }

      const lastMessage = messages[messages.length - 1];

      // Check if it's an AI message with tool calls
      if (
        !(lastMessage instanceof AIMessage) ||
        !lastMessage.tool_calls?.length
      ) {
        return;
      }

      // Separate tool calls that need interrupts from those that don't
      const interruptToolCalls: ToolCall[] = [];
      const autoApprovedToolCalls: ToolCall[] = [];

      for (const toolCall of lastMessage.tool_calls) {
        // Ensure tool call has an ID
        const normalizedToolCall: ToolCall = {
          id: toolCall.id || uuid(),
          name: toolCall.name,
          args: toolCall.args,
        };

        const toolConfig = config.toolConfigs[normalizedToolCall.name];

        if (toolConfig?.requireApproval) {
          interruptToolCalls.push(normalizedToolCall);
        } else {
          autoApprovedToolCalls.push(normalizedToolCall);
        }
      }

      // If no interrupts needed, return early
      if (!interruptToolCalls.length) {
        return;
      }

      const approvedToolCalls = [...autoApprovedToolCalls];

      // Process tool calls that need interrupts
      const requests: ToolApprovalRequest[] = interruptToolCalls.map(
        (toolCall) => {
          const toolConfig = config.toolConfigs[toolCall.name];
          const description =
            toolConfig?.description ||
            `${config.messagePrefix}\n\nTool: ${
              toolCall.name
            }\nArgs: ${JSON.stringify(toolCall.args, null, 2)}`;

          return {
            action: toolCall.name,
            args: toolCall.args,
            toolCallId: toolCall.id,
            description,
          };
        }
      );

      // Interrupt and wait for human responses
      const responses = (await interrupt(requests)) as HumanResponse[];

      // Process responses
      for (let i = 0; i < responses.length; i++) {
        const response = responses[i];
        const toolCall = interruptToolCalls[i];

        switch (response.type) {
          case "accept":
            approvedToolCalls.push(toolCall);
            break;

          case "edit":
            // For edit, args is an ActionRequest with updated args
            if (
              response.args &&
              typeof response.args === "object" &&
              "args" in response.args
            ) {
              approvedToolCalls.push({
                ...toolCall,
                args: (
                  response.args as { action: string; args: Record<string, any> }
                ).args,
              });
            }
            break;

          case "ignore":
            // Skip to end - terminate the agent
            return controls.terminate();

          case "response":
            // Return manual tool response and jump back to model
            // For response, args is a string
            const toolMessage = new ToolMessage({
              content: typeof response.args === "string" ? response.args : "",
              tool_call_id: toolCall.id,
            });
            return controls.jumpTo("model", {
              messages: [...state.messages, toolMessage],
            });

          default:
            throw new Error(`Unknown response type: ${(response as any).type}`);
        }
      }

      // Update the last message with approved tool calls
      const updatedMessage = new AIMessage({
        content: lastMessage.content,
        tool_calls: approvedToolCalls,
        id: lastMessage.id,
      });

      // Replace the last message with the updated one
      return {
        messages: [...state.messages.slice(0, -1), updatedMessage],
      };
    },
  });
}
