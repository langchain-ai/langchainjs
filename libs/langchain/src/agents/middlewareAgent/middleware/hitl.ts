/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod/v3";
import { v4 as uuid } from "uuid";
import { AIMessage, ToolMessage } from "@langchain/core/messages";
import { interrupt } from "@langchain/langgraph";

import { createMiddleware } from "../middleware.js";
import type { ToolCall } from "../types.js";

/**
 * Interrupt request for tool approval
 */
export interface ToolApprovalRequest {
  action: string;
  args: Record<string, any>;
  toolCallId: string;
  description?: string;
}

const contextSchema = z
  .object({
    toolConfigs: z
      .record(
        z.object({
          requireApproval: z.boolean().optional(),
          description: z.string().optional(),
        })
      )
      .default({}),
    messagePrefix: z.string().default("Tool execution requires approval"),
  })
  .optional();

/**
 * Creates a Human-in-the-Loop (HITL) middleware for tool approval and oversight.
 *
 * This middleware intercepts tool calls made by an AI agent and provides human oversight
 * capabilities before execution. It enables selective approval workflows where certain tools
 * require human intervention while others can execute automatically.
 *
 * A invocation result that has been interrupted by the middleware will have a `__interrupt__`
 * property that contains the interrupt request. You can loop over the request to determine
 * which tools were interrupted, and how to handle them separately.
 *
 * ```ts
 * import { type ToolApprovalRequest, type HumanInTheLoopMiddlewareHumanResponse } from "langchain/middleware";
 * import { type Interrupt } from "langchain";
 *
 * const result = await agent.invoke(request);
 * const interruptRequest = initialResult.__interrupt__?.[0] as Interrupt<
 *   ToolApprovalRequest[]
 * >;
 * const resume: HumanInTheLoopMiddlewareHumanResponse[] =
 *   interruptRequest.value.map((request) => {
 *     if (request.action === "calculator") {
 *       return { id: request.toolCallId, type: "accept" };
 *     } else if (request.action === "write_file") {
 *       return {
 *         id: request.toolCallId,
 *         type: "edit",
 *         args: { filename: "safe.txt", content: "Safe content" },
 *       };
 *     }
 *
 *     throw new Error(`Unknown action: ${request.action}`);
 *   });
 *
 * // Resume with approval
 * await agent.invoke(new Command({ resume }), config);
 * ```
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
    afterModel: async (state, runtime) => {
      const config = { ...contextSchema.parse(options), ...runtime.context };
      const { messages } = state;
      if (!messages.length) {
        return;
      }

      const lastMessage = messages.at(-1);

      /**
       * Check if it's an AI message with tool calls
       */
      if (
        !AIMessage.isInstance(lastMessage) ||
        !lastMessage.tool_calls?.length
      ) {
        // Clear any existing jumpTo property since there are no tool calls to process
        return { jumpTo: undefined };
      }

      // Filter out structured response extraction tool calls (they start with "extract-")
      const regularToolCalls = lastMessage.tool_calls.filter(
        (toolCall) => !toolCall.name.startsWith("extract-")
      );

      // If all tool calls are structured response extractions, return early
      if (regularToolCalls.length === 0) {
        // Clear any existing jumpTo property since we're not processing any real tools
        return { jumpTo: undefined };
      }

      if (!config.toolConfigs) {
        throw new Error("HumanInTheLoopMiddleware: toolConfigs is required");
      }

      const toolConfigs = config.toolConfigs;

      /**
       * Separate tool calls that need interrupts from those that don't
       */
      const interruptToolCalls: ToolCall[] = [];
      const autoApprovedToolCalls: ToolCall[] = [];

      for (const toolCall of regularToolCalls) {
        /**
         * Ensure tool call has an ID
         */
        const normalizedToolCall: ToolCall = {
          id: toolCall.id || uuid(),
          name: toolCall.name,
          args: toolCall.args,
        };

        const toolConfig = toolConfigs[normalizedToolCall.name];

        if (toolConfig?.requireApproval) {
          interruptToolCalls.push(normalizedToolCall);
        } else {
          autoApprovedToolCalls.push(normalizedToolCall);
        }
      }

      /**
       * If no interrupts needed, return early
       */
      if (!interruptToolCalls.length) {
        // Clear any existing jumpTo property since no interrupts are needed
        return { jumpTo: undefined };
      }

      /**
       * Process tool calls that need interrupts
       */
      const requests: ToolApprovalRequest[] = interruptToolCalls.map(
        (toolCall) => {
          const toolConfig = toolConfigs[toolCall.name];
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

      /**
       * Interrupt and wait for human responses
       */
      const responses = (await interrupt(
        requests
      )) as HumanInTheLoopMiddlewareHumanResponse[];

      /**
       * double check that all interrupts have a response
       */
      const missingResponses: string[] = [];
      for (const toolCall of interruptToolCalls) {
        if (!responses?.find((response) => response.id === toolCall.id)) {
          missingResponses.push(toolCall.name);
        }
      }
      if (missingResponses.length > 0) {
        throw new Error(
          `Missing responses for tool calls: ${missingResponses.join(", ")}`
        );
      }

      const approvedToolCalls = [...autoApprovedToolCalls];
      const toolMessages: ToolMessage[] = [];

      /**
       * Process responses
       */
      for (const [i, response] of Object.entries(responses)) {
        const toolCall = interruptToolCalls[
          i as keyof typeof interruptToolCalls
        ] as ToolCall;
        if (!toolCall) {
          throw new Error(
            `Tool call "${
              response.id
            }" not interrupted, interruptToolCalls: ${interruptToolCalls
              .map((toolCall) => toolCall.id)
              .join(", ")}`
          );
        }

        switch (response.type) {
          case "accept":
            approvedToolCalls.push(toolCall);
            break;

          case "edit":
            /**
             * For edit, args is an ActionRequest with updated args
             */
            if (
              "args" in response &&
              typeof response.args === "object" &&
              response.args !== null
            ) {
              approvedToolCalls.push({
                ...toolCall,
                args: response.args,
              });
            }
            break;

          case "ignore":
            /**
             * Skip to end - terminate the agent
             */
            return runtime.terminate({
              ...state,
              messages: [
                ...state.messages,
                /**
                 * inject an artificial tool message to indicate that the tool was ignored
                 */
                new ToolMessage({
                  content: `User ignored the tool call for ${toolCall.name} with id ${toolCall.id}`,
                  tool_call_id: toolCall.id,
                }),
              ],
            });

          case "response": {
            /**
             * Return manual tool response and jump back to model
             * For response, args is a string
             */
            toolMessages.push(
              new ToolMessage({
                content: typeof response.args === "string" ? response.args : "",
                tool_call_id: toolCall.id,
              })
            );
            break;
          }
          default:
            throw new Error(`Unknown response type: ${(response as any).type}`);
        }
      }

      /**
       * Replace the tool calls with the approved tool calls
       */
      if (AIMessage.isInstance(lastMessage)) {
        lastMessage.tool_calls = lastMessage.tool_calls?.map((tc) => {
          const approvedToolCall = approvedToolCalls.find(
            (atc) => atc.id === tc.id
          );
          return approvedToolCall ?? tc;
        });
      }

      /**
       * Replace the last message with the updated one
       */
      return {
        messages: [...state.messages, ...toolMessages],
      };
    },
  });
}

export interface HumanInTheLoopMiddlewareResponse {
  id: string;
}

export interface HumanInTheLoopMiddlewareAcceptResponse
  extends HumanInTheLoopMiddlewareResponse {
  type: "accept";
}

export interface HumanInTheLoopMiddlewareIgnoreResponse
  extends HumanInTheLoopMiddlewareResponse {
  type: "ignore";
}

export interface HumanInTheLoopMiddlewareResponseResponse
  extends HumanInTheLoopMiddlewareResponse {
  type: "response";
  args: unknown;
}

export interface HumanInTheLoopMiddlewareEditResponse
  extends HumanInTheLoopMiddlewareResponse {
  type: "edit";
  args: unknown;
}

/**
 * The response provided by a human to an interrupt.
 */
export type HumanInTheLoopMiddlewareHumanResponse =
  | HumanInTheLoopMiddlewareAcceptResponse
  | HumanInTheLoopMiddlewareIgnoreResponse
  | HumanInTheLoopMiddlewareResponseResponse
  | HumanInTheLoopMiddlewareEditResponse;
