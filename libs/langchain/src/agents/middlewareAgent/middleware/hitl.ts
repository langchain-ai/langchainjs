/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod/v3";
import { v4 as uuid } from "uuid";
import { AIMessage, ToolMessage, isAIMessage } from "@langchain/core/messages";
import { interrupt } from "@langchain/langgraph";

import { createMiddleware } from "../middleware.js";
import type { ToolCall } from "../types.js";
import { HumanResponse } from "../../interrupt.js";

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
 * Creates a Human-in-the-Loop (HITL) middleware for tool approval and oversight.
 *
 * This middleware intercepts tool calls made by an AI agent and provides human oversight
 * capabilities before execution. It enables selective approval workflows where certain tools
 * require human intervention while others can execute automatically.
 *
 * ## Features
 *
 * - **Selective Tool Approval**: Configure which tools require human approval
 * - **Multiple Response Types**: Accept, edit, ignore, or manually respond to tool calls
 * - **Asynchronous Workflow**: Uses LangGraph's interrupt mechanism for non-blocking approval
 * - **Custom Approval Messages**: Provide context-specific descriptions for approval requests
 *
 * ## Response Types
 *
 * When a tool requires approval, the human operator can respond with:
 * - `accept`: Execute the tool with original arguments
 * - `edit`: Modify the tool arguments before execution
 * - `ignore`: Skip the tool and terminate the agent
 * - `response`: Provide a manual response instead of executing the tool
 *
 * @param options - Configuration options for the middleware
 * @param options.toolConfigs - Per-tool configuration mapping tool names to their settings
 * @param options.toolConfigs[toolName].requireApproval - Whether the tool requires human approval
 * @param options.toolConfigs[toolName].description - Custom approval message for the tool
 * @param options.messagePrefix - Default prefix for approval messages (default: "Tool execution requires approval")
 *
 * @returns A middleware instance that can be passed to `createAgent`
 *
 * @example
 * Basic usage with selective tool approval
 * ```typescript
 * import { humanInTheLoopMiddleware } from "langchain/middleware";
 * import { createAgent } from "langchain";
 *
 * const hitlMiddleware = humanInTheLoopMiddleware({
 *   toolConfigs: {
 *     "write_file": {
 *       requireApproval: true,
 *       description: "⚠️ File write operation requires approval"
 *     },
 *     "read_file": {
 *       requireApproval: false  // Safe operation, no approval needed
 *     }
 *   }
 * });
 *
 * const agent = createAgent({
 *   model: "openai:gpt-4",
 *   tools: [writeFileTool, readFileTool],
 *   middleware: [hitlMiddleware]
 * });
 * ```
 *
 * @example
 * Handling approval requests
 * ```typescript
 * import { Command } from "@langchain/langgraph";
 *
 * // Initial agent invocation
 * const result = await agent.invoke({
 *   messages: [new HumanMessage("Write 'Hello' to output.txt")]
 * }, config);
 *
 * // Check if agent is paused for approval
 * const state = await agent.graph.getState(config);
 * if (state.next?.length > 0) {
 *   // Get interrupt details
 *   const task = state.tasks?.[0];
 *   const requests = task?.interrupts?.[0]?.value;
 *
 *   // Show tool call details to user
 *   console.log("Tool:", requests[0].action);
 *   console.log("Args:", requests[0].args);
 *
 *   // Resume with approval
 *   await agent.invoke(
 *     new Command({ resume: [{ type: "accept" }] }),
 *     config
 *   );
 * }
 * ```
 *
 * @example
 * Different response types
 * ```typescript
 * // Accept the tool call as-is
 * new Command({ resume: [{ type: "accept" }] })
 *
 * // Edit the tool arguments
 * new Command({
 *   resume: [{
 *     type: "edit",
 *     args: { action: "write_file", args: { filename: "safe.txt", content: "Modified" } }
 *   }]
 * })
 *
 * // Skip tool and terminate agent
 * new Command({ resume: [{ type: "ignore" }] })
 *
 * // Provide manual response
 * new Command({
 *   resume: [{
 *     type: "response",
 *     args: "File operation not allowed in demo mode"
 *   }]
 * })
 * ```
 *
 * @example
 * Production use case with database operations
 * ```typescript
 * const hitlMiddleware = humanInTheLoopMiddleware({
 *   toolConfigs: {
 *     "execute_sql": {
 *       requireApproval: true,
 *       description: "🚨 SQL query requires DBA approval\nPlease review for safety and performance"
 *     },
 *     "read_schema": {
 *       requireApproval: false  // Reading metadata is safe
 *     },
 *     "delete_records": {
 *       requireApproval: true,
 *       description: "⛔ DESTRUCTIVE OPERATION - Requires manager approval"
 *     }
 *   },
 *   messagePrefix: "Database operation pending approval"
 * });
 * ```
 *
 * @remarks
 * - Tool calls are processed in the order they appear in the AI message
 * - Auto-approved tools execute immediately without interruption
 * - Multiple tools requiring approval are bundled into a single interrupt
 * - The middleware operates in the `afterModel` phase, intercepting before tool execution
 * - Requires a checkpointer to maintain state across interruptions
 *
 * @see {@link createAgent} for agent creation
 * @see {@link Command} for resuming interrupted execution
 * @public
 */
export function humanInTheLoopMiddleware(
  options: z.input<typeof contextSchema> = {}
) {
  return createMiddleware({
    name: "HumanInTheLoopMiddleware",
    contextSchema,
    afterModel: async (state, runtime, controls) => {
      const config = { ...contextSchema.parse(options), ...runtime.context };
      const { messages } = state;

      if (!messages.length) {
        return;
      }

      const lastMessage = messages[messages.length - 1];

      // Check if it's an AI message with tool calls
      if (!isAIMessage(lastMessage) || !lastMessage.tool_calls?.length) {
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

          case "response": {
            // Return manual tool response and jump back to model
            // For response, args is a string
            const toolMessage = new ToolMessage({
              content: typeof response.args === "string" ? response.args : "",
              tool_call_id: toolCall.id,
            });
            return {
              messages: [...state.messages, toolMessage],
              jump_to: "model",
            };
          }
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
