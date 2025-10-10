/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod/v3";
import { AIMessage, ToolMessage } from "@langchain/core/messages";
import {
  InferInteropZodInput,
  interopParse,
} from "@langchain/core/utils/types";
import { interrupt } from "@langchain/langgraph";

import { createMiddleware } from "../middleware.js";
import type { AgentBuiltInState, Runtime } from "../types.js";

type ToolCall = NonNullable<AIMessage["tool_calls"]>[number];

/**
 * Function type that dynamically generates a description based on agent state,
 * runtime, and tool call information.
 */
export type DescriptionFactory<
  State extends AgentBuiltInState = AgentBuiltInState
> = (
  toolCall: ToolCall,
  state: State,
  runtime: Runtime<unknown>
) => string | Promise<string>;


/**
 * Represents a tool action with its name and arguments.
 */
export interface Action {
  /**
   * The tool/action name (e.g., "send_email").
   */
  name: string;
  /**
   * Arguments for the tool call (e.g., {"a": 1, "b": 2}).
   */
  arguments: Record<string, any>;
}

/**
 * Describes the agent-requested tool action (name and arguments).
 * This is what the AI intends to execute, subject to human review.
 */
export interface ActionRequest {
  /**
   * The tool/action name requested by the agent (e.g., "send_email").
   */
  name: string;
  /**
   * Arguments for the requested tool call (e.g., {"a": 1, "b": 2}).
   */
  arguments: Record<string, any>;
  /**
   * Optional human-facing description for this specific action request.
   */
  description?: string;
}

/**
 * Decision types that can be made by the human reviewer.
 */
export type DecisionType = "approve" | "edit" | "reject";

/**
 * Configuration for reviewing a specific action.
 */
export interface ReviewConfig {
  /**
   * The name of the action being reviewed.
   */
  actionName: string;
  /**
   * List of decision types allowed for this action.
   */
  allowedDecisions: DecisionType[];
  /**
   * Optional schema for validating action arguments.
   */
  argumentsSchema?: Record<string, any>;
}

/**
 * Represents an interrupt triggered by the graph that requires human intervention
 * to approve, edit, or reject agent-requested tool actions.
 *
 * @example
 * ```ts
 * const hitlRequest: HITLRequest = {
 *   actionRequests: [
 *     { name: "write_file", arguments: { filename: "test.txt" }, description: "Writing file" }
 *   ],
 *   reviewConfigs: [
 *     { actionName: "write_file", allowedDecisions: ["approve", "edit", "reject"] }
 *   ]
 * };
 * const response = interrupt(hitlRequest);
 * ```
 */
export interface HITLRequest {
  /**
   * List of agent-requested tool actions to be reviewed.
   */
  actionRequests: ActionRequest[];
  /**
   * Configuration for each action specifying allowed decisions.
   */
  reviewConfigs: ReviewConfig[];
}

/**
 * Decision to approve the agent-requested action as-is.
 */
export interface ApproveDecision {
  type: "approve";
}

/**
 * Decision to edit the agent-requested action before execution.
 */
export interface EditDecision {
  type: "edit";
  /**
   * The modified action with updated name and/or arguments.
   */
  editedAction: Action;
}

/**
 * Decision to reject the agent-requested action.
 */
export interface RejectDecision {
  type: "reject";
  /**
   * Optional message explaining the rejection.
   */
  message?: string;
}

/**
 * Union type representing all possible decision types.
 */
export type Decision = ApproveDecision | EditDecision | RejectDecision;

/**
 * Response containing decisions for all interrupted actions.
 */
export interface HITLResponse {
  /**
   * List of decisions corresponding to each action request.
   */
  decisions: Decision[];
}


/**
 * Configuration for interrupting on a specific tool.
 */
export interface InterruptOnConfig {
  /**
   * List of decision types allowed for this tool.
   */
  allowedDecisions: DecisionType[];
  /**
   * Human-facing description shown in the approval request.
   * Can be either:
   * - A static string describing the approval request
   * - A callable that dynamically generates the description based on agent state,
   *   runtime, and tool call information
   */
  description?: string | DescriptionFactory;
  /**
   * Optional schema for validating action arguments.
   */
  argumentsSchema?: Record<string, any>;
}

const InterruptOnConfigSchema = z.object({
  /**
   * List of decision types allowed for this tool.
   */
  allowedDecisions: z.array(z.enum(["approve", "edit", "reject"])),
  /**
   * Human-facing description shown in the approval request.
   */
  description: z.union([z.string(), z.function()]).optional(),
  /**
   * Optional schema for validating action arguments.
   */
  argumentsSchema: z.record(z.any()).optional(),
});

const contextSchema = z.object({
  /**
   * Mapping of tool name to allowed reviewer responses.
   * If a tool doesn't have an entry, it's auto-approved by default.
   *
   * - `true` -> pause for approval and allow approve/edit/reject
   * - `false` -> auto-approve (no human review)
   * - `InterruptOnConfig` -> explicitly specify which decisions are allowed for this tool
   */
  interruptOn: z
    .record(z.union([z.boolean(), InterruptOnConfigSchema]))
    .optional(),
  /**
   * Prefix used when constructing human-facing approval messages.
   * Provides context about the tool call being reviewed; does not change the underlying action.
   *
   * Note: This prefix is only applied for tools that do not provide a custom
   * `description` via their configuration. If a tool specifies a custom
   * `description`, that per-tool text is used and this prefix is ignored.
   */
  descriptionPrefix: z.string().default("Tool execution requires approval"),
});
export type HumanInTheLoopMiddlewareConfig = InferInteropZodInput<
  typeof contextSchema
>;

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
 * import { type HITLRequest, type HITLResponse } from "langchain";
 * import { type Interrupt } from "langchain";
 *
 * const result = await agent.invoke(request);
 * const interruptRequest = result.__interrupt__?.[0] as Interrupt<HITLRequest>;
 *
 * const decisions = interruptRequest.value.actionRequests.map((actionRequest) => {
 *   if (actionRequest.name === "calculator") {
 *     return { type: "approve" as const };
 *   } else if (actionRequest.name === "write_file") {
 *     return {
 *       type: "edit" as const,
 *       editedAction: {
 *         name: "write_file",
 *         arguments: { filename: "safe.txt", content: "Safe content" }
 *       },
 *     };
 *   }
 *
 *   throw new Error(`Unknown action: ${actionRequest.name}`);
 * });
 *
 * // Resume with approval
 * await agent.invoke(new Command({ resume: { decisions } }), config);
 * ```
 *
 * ## Features
 *
 * - **Selective Tool Approval**: Configure which tools require human approval
 * - **Multiple Response Types**: Accept, edit, ignore, or manually respond to tool calls
 * - **Asynchronous Workflow**: Uses LangGraph's interrupt mechanism for non-blocking approval
 * - **Custom Approval Messages**: Provide context-specific descriptions for approval requests
 *
 * ## Decision Types
 *
 * When a tool requires approval, the human operator can respond with:
 * - `approve`: Execute the tool with original arguments
 * - `edit`: Modify the tool name and/or arguments before execution
 * - `reject`: Reject the tool execution and provide an optional message
 *
 * @param options - Configuration options for the middleware
 * @param options.interruptOn - Per-tool configuration mapping tool names to their settings
 * @param options.interruptOn[toolName].allowedDecisions - Array of decision types allowed for this tool ("approve", "edit", "reject")
 * @param options.interruptOn[toolName].description - Custom approval message for the tool. Can be either a static string or a callable that dynamically generates the description based on agent state, runtime, and tool call information
 * @param options.interruptOn[toolName].argumentsSchema - Optional schema for validating action arguments
 * @param options.descriptionPrefix - Default prefix for approval messages (default: "Tool execution requires approval"). Only used for tools that do not define a custom `description` in their configuration.
 *
 * @returns A middleware instance that can be passed to `createAgent`
 *
 * @example
 * Basic usage with selective tool approval
 * ```typescript
 * import { humanInTheLoopMiddleware } from "langchain";
 * import { createAgent } from "langchain";
 *
 * const hitlMiddleware = humanInTheLoopMiddleware({
 *   interruptOn: {
 *     // Interrupt write_file tool and allow edits or approvals
 *     "write_file": {
 *       allowedDecisions: ["approve", "edit", "reject"],
 *       description: "⚠️ File write operation requires approval"
 *     },
 *     // Auto-approve read_file tool
 *     "read_file": false
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
 * import { type HITLRequest, type Interrupt } from "langchain";
 * import { Command } from "@langchain/langgraph";
 *
 * // Initial agent invocation
 * const result = await agent.invoke({
 *   messages: [new HumanMessage("Write 'Hello' to output.txt")]
 * }, config);
 *
 * // Check if agent is paused for approval
 * if (result.__interrupt__) {
 *   const interruptRequest = result.__interrupt__?.[0] as Interrupt<HITLRequest>;
 *
 *   // Show tool call details to user
 *   console.log("Actions:", interruptRequest.value.actionRequests);
 *   console.log("Review configs:", interruptRequest.value.reviewConfigs);
 *
 *   // Resume with approval
 *   await agent.invoke(
 *     new Command({ resume: { decisions: [{ type: "approve" }] } }),
 *     config
 *   );
 * }
 * ```
 *
 * @example
 * Different decision types
 * ```typescript
 * // Approve the tool call as-is
 * new Command({ resume: { decisions: [{ type: "approve" }] } })
 *
 * // Edit the tool name and/or arguments
 * new Command({
 *   resume: {
 *     decisions: [{
 *       type: "edit",
 *       editedAction: { name: "write_file", arguments: { filename: "safe.txt", content: "Modified" } }
 *     }]
 *   }
 * })
 *
 * // Reject the tool call
 * new Command({ resume: { decisions: [{ type: "reject" }] } })
 *
 * // Reject with custom message
 * new Command({
 *   resume: {
 *     decisions: [{
 *       type: "reject",
 *       message: "File operation not allowed in demo mode"
 *     }]
 *   }
 * })
 * ```
 *
 * @example
 * Production use case with database operations
 * ```typescript
 * const hitlMiddleware = humanInTheLoopMiddleware({
 *   interruptOn: {
 *     "execute_sql": {
 *       allowedDecisions: ["approve", "edit", "reject"],
 *       description: "🚨 SQL query requires DBA approval\nPlease review for safety and performance"
 *     },
 *     "read_schema": false  // Reading metadata is safe
 *     "delete_records": {
 *       allowedDecisions: ["approve", "reject"],
 *       description: "⛔ DESTRUCTIVE OPERATION - Requires manager approval"
 *     }
 *   },
 *   descriptionPrefix: "Database operation pending approval"
 * });
 * ```
 *
 * @example
 * Using dynamic callable descriptions
 * ```typescript
 * import { type DescriptionFactory } from "langchain";
 *
 * // Define a dynamic description factory
 * const formatToolDescription: DescriptionFactory = (toolCall, state, runtime) => {
 *   return `Tool: ${toolCall.name}\nArguments:\n${JSON.stringify(toolCall.args, null, 2)}`;
 * };
 *
 * const hitlMiddleware = humanInTheLoopMiddleware({
 *   interruptOn: {
 *     "write_file": {
 *       allowedDecisions: ["approve", "edit", "reject"],
 *       // Use dynamic description that can access tool call, state, and runtime
 *       description: formatToolDescription
 *     },
 *     // Or use an inline function
 *     "send_email": {
 *       allowedDecisions: ["approve", "reject"],
 *       description: (toolCall, state, runtime) => {
 *         const { to, subject } = toolCall.args;
 *         return `Email to ${to}\nSubject: ${subject}\n\nRequires approval before sending`;
 *       }
 *     }
 *   }
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
  options: NonNullable<HumanInTheLoopMiddlewareConfig>
) {
  return createMiddleware({
    name: "HumanInTheLoopMiddleware",
    contextSchema,
    afterModelJumpTo: ["model"],
    afterModel: async (state, runtime) => {
      const config = interopParse(contextSchema, {
        ...options,
        ...(runtime.context || {}),
      });
      if (!config) {
        return;
      }

      const { messages } = state;
      if (!messages.length) {
        return;
      }

      /**
       * Don't do anything if the last message isn't an AI message with tool calls.
       */
      const lastMessage = [...messages]
        .reverse()
        .find((msg) => AIMessage.isInstance(msg)) as AIMessage;
      if (!lastMessage || !lastMessage.tool_calls?.length) {
        return;
      }

      /**
       * If the user omits the interruptOn config, we don't do anything.
       */
      if (!config.interruptOn) {
        return;
      }

      // Resolve per-tool configs (boolean true -> all decisions allowed; false -> auto-approve)
      const resolvedToolConfigs: Record<string, InterruptOnConfig> = {};
      for (const [toolName, toolConfig] of Object.entries(config.interruptOn)) {
        if (typeof toolConfig === "boolean") {
          if (toolConfig === true) {
            resolvedToolConfigs[toolName] = {
              allowedDecisions: ["approve", "edit", "reject"],
            };
          }
        } else {
          resolvedToolConfigs[toolName] = toolConfig as InterruptOnConfig;
        }
      }

      const interruptToolCalls: ToolCall[] = [];
      const autoApprovedToolCalls: ToolCall[] = [];

      for (const toolCall of lastMessage.tool_calls) {
        if (toolCall.name in resolvedToolConfigs) {
          interruptToolCalls.push(toolCall);
        } else {
          autoApprovedToolCalls.push(toolCall);
        }
      }

      /**
       * No interrupt tool calls, so we can just return.
       */
      if (!interruptToolCalls.length) {
        return;
      }

      const actionRequests: ActionRequest[] = await Promise.all(
        interruptToolCalls.map(async (toolCall) => {
          const toolConfig = resolvedToolConfigs[toolCall.name]!;
          const description = toolConfig.description
            ? typeof toolConfig.description === "function"
              ? /**
                 * If description is a function, call it with the required parameters
                 */
                await toolConfig.description(toolCall, state, runtime)
              : /**
                 * Otherwise, use the static string
                 */
                toolConfig.description
            : /**
               * Fall back to the default description
               */
              `${config.descriptionPrefix}\n\nTool: ${
                toolCall.name
              }\nArgs: ${JSON.stringify(toolCall.args, null, 2)}`;

          return {
            name: toolCall.name,
            arguments: toolCall.args,
            description,
          };
        })
      );

      const reviewConfigs: ReviewConfig[] = interruptToolCalls.map(
        (toolCall) => {
          const toolConfig = resolvedToolConfigs[toolCall.name]!;
          return {
            actionName: toolCall.name,
            allowedDecisions: toolConfig.allowedDecisions,
            argumentsSchema: toolConfig.argumentsSchema,
          };
        }
      );

      const hitlRequest: HITLRequest = {
        actionRequests,
        reviewConfigs,
      };

      const hitlResponse = (await interrupt(hitlRequest)) as HITLResponse;

      if (hitlResponse.decisions.length !== interruptToolCalls.length) {
        throw new Error(
          `Number of human decisions (${hitlResponse.decisions.length}) does not match number of interrupted tool calls (${interruptToolCalls.length}).`
        );
      }

      const approvedToolCalls: ToolCall[] = [...autoApprovedToolCalls];
      const artificialToolMessages: ToolMessage[] = [];

      for (const [i, decision] of hitlResponse.decisions.entries()) {
        const toolCall = interruptToolCalls[i]!;
        const reviewConfig = reviewConfigs[i]!;

        if (
          decision.type === "approve" &&
          reviewConfig.allowedDecisions.includes("approve")
        ) {
          approvedToolCalls.push(toolCall);
          continue;
        }

        if (
          decision.type === "edit" &&
          reviewConfig.allowedDecisions.includes("edit")
        ) {
          const edited = decision.editedAction;
          approvedToolCalls.push({
            id: toolCall.id,
            name: edited.name,
            args: edited.arguments,
          });
          continue;
        }

        if (
          decision.type === "reject" &&
          reviewConfig.allowedDecisions.includes("reject")
        ) {
          const content =
            decision.message ??
            `User rejected the tool call for \`${toolCall.name}\` with id ${toolCall.id}`;

          /**
           * Providing a meaningful error message for this case that should never happen.
           */
          if (!toolCall.id) {
            throw new Error(
              `Can't provide custom tool response for tool call without an ID: ${toolCall.name}!\n` +
                "This use case is not expected to happen, please report this as a bug."
            );
          }

          /**
           * ToolMessage expects a string, so we need to throw an error if it's not a string
           * as we currently have no way to proper type responses from users through the
           * Command object.
           */
          if (typeof content !== "string") {
            throw new Error(
              `Tool call response for "${
                toolCall.name
              }" must be a string, got ${typeof content}`
            );
          }

          artificialToolMessages.push(
            new ToolMessage({
              content,
              name: toolCall.name,
              tool_call_id: toolCall.id,
              status: "error",
            })
          );
          continue;
        }

        const allowedDecisions = reviewConfig.allowedDecisions.join('", "');
        throw new Error(
          `Unexpected human decision: ${JSON.stringify(
            decision
          )}. Decision type '${decision.type}' is not allowed for tool '${
            toolCall.name
          }'. Expected one of: "${allowedDecisions}", based on the tool's configuration.`
        );
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

      if (approvedToolCalls.length > 0) {
        return { messages: [...state.messages, ...artificialToolMessages] };
      }

      return {
        jumpTo: "model",
        messages: [...state.messages, ...artificialToolMessages],
      };
    },
  });
}
