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

const ToolConfigSchema = z.object({
  /**
   * Whether the human can approve the current action without changes
   */
  allowAccept: z.boolean().optional(),
  /**
   * Whether the human can reject the current action with feedback
   */
  allowEdit: z.boolean().optional(),
  /**
   * Whether the human can approve the current action with edited content
   */
  allowRespond: z.boolean().optional(),
  /**
   * The description attached to the request for human input.
   * Can be either:
   * - A static string describing the approval request
   * - A callable that dynamically generates the description based on agent state,
   *   runtime, and tool call information
   *
   * @example
   * Static string description
   * ```typescript
   * const config: ToolConfig = {
   *   allowAccept: true,
   *   description: "Please review this tool execution"
   * };
   * ```
   *
   * @example
   * Dynamic callable description
   * ```typescript
   * const formatToolDescription: DescriptionFactory = (toolCall, state, runtime) => {
   *   return `Tool: ${toolCall.name}\nArguments:\n${JSON.stringify(toolCall.args, null, 2)}`;
   * };
   *
   * const config: ToolConfig = {
   *   allowAccept: true,
   *   description: formatToolDescription
   * };
   * ```
   */
  description: z.union([z.string(), z.function()]).optional(),
});

type ToolConfigSchema = z.input<typeof ToolConfigSchema>;
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
 * Configuration that defines which reviewer response types are permitted during a human interrupt.
 * These flags control what the human reviewer may do (e.g., accept/edit/respond),
 * not the tool action the agent has requested.
 */
export interface HumanInTheLoopConfig
  extends Omit<ToolConfigSchema, "description"> {}

/**
 * Describes the agent-requested tool action (name and arguments).
 * This is what the AI intends to execute, subject to human review.
 */
export interface ActionRequest {
  /**
   * The tool/action name requested by the agent (e.g., "send_email").
   */
  action: string;
  /**
   * Arguments for the requested tool call (e.g., {"a": 1, "b": 2}).
   */
  args: Record<string, any>;
}

/**
 * Represents an interrupt triggered by the graph that requires human intervention
 * to approve, edit, or respond to an agent-requested tool action.
 *
 * @example
 * ```ts
 * const hitlRequest: HumanInTheLoopRequest = {
 *   actionRequest: { action: "Approve XYZ action", args: { ... } },
 *   config: { allowAccept: true, allowEdit: true, allowRespond: true },
 *   description: "Please review the command before execution"
 * };
 * response = interrupt([request])[0]
 * ```
 */
export interface HumanInTheLoopRequest {
  /**
   * The agent-requested tool action to be reviewed.
   */
  actionRequest: ActionRequest;
  /**
   * Which reviewer responses are allowed (accept/edit/respond).
   */
  config: HumanInTheLoopConfig;
  /**
   * Optional human-facing description shown in the approval prompt.
   */
  description?: string;
}

/**
 * Response when a human approves the agent-requested action.
 */
export interface AcceptPayload {
  type: "accept";
}

/**
 * Response when a human provides a manual response instead of executing
 * the agent-requested action.
 */
export interface ResponsePayload {
  type: "response";
  args?: string;
}

/**
 * Response when a human edits the agent-requested action (tool name and/or args).
 */
export interface EditPayload {
  type: "edit";
  args: ActionRequest;
}

export type HumanInTheLoopMiddlewareHumanResponse =
  | AcceptPayload
  | ResponsePayload
  | EditPayload;

/**
 * Configuration for a tool requiring human in the loop.
 */
export interface ToolConfig extends HumanInTheLoopConfig {
  /**
   * Human-facing description shown in the approval request.
   * Can be either:
   * - A static string describing the approval request
   * - A callable that dynamically generates the description based on agent state,
   *   runtime, and tool call information
   */
  description?: string | DescriptionFactory;
}

const contextSchema = z.object({
  /**
   * Mapping of tool name to allowed reviewer responses.
   * If a tool doesn't have an entry, it's auto-approved by default.
   *
   * - `true` -> pause for approval and allow accept/edit/respond
   * - `false` -> auto-approve (no human review)
   * - `ToolConfig` -> explicitly specify which reviewer responses are allowed for this tool
   */
  interruptOn: z.record(z.union([z.boolean(), ToolConfigSchema])).optional(),
  /**
   * Prefix used when constructing human-facing approval messages.
   * Provides context about the tool call being reviewed; does not change the underlying action.
   *
   * Note: This prefix is only applied for tools that do not provide a custom
   * `description` via their {@link ToolConfig}. If a tool specifies a custom
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
 * import { type ToolApprovalRequest, type HumanInTheLoopMiddlewareHumanResponse } from "langchain";
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
 * @param options.interruptOn - Per-tool configuration mapping tool names to their settings
 * @param options.interruptOn[toolName].allowAccept - Whether the human can approve the current action without changes
 * @param options.interruptOn[toolName].allowEdit - Whether the human can reject the current action with feedback
 * @param options.interruptOn[toolName].allowRespond - Whether the human can approve the current action with edited content
 * @param options.interruptOn[toolName].description - Custom approval message for the tool. Can be either a static string or a callable that dynamically generates the description based on agent state, runtime, and tool call information
 * @param options.messagePrefix - Default prefix for approval messages (default: "Tool execution requires approval"). Only used for tools that do not define a custom `description` in their ToolConfig.
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
 *     // Interrupt write_file tool and allow edits or accepts
 *     "write_file": {
 *       allowEdit: true,
 *       allowAccept: true,
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
 * import { type HumanInTheLoopRequest, type Interrupt } from "langchain";
 * import { Command } from "@langchain/langgraph";
 *
 * // Initial agent invocation
 * const result = await agent.invoke({
 *   messages: [new HumanMessage("Write 'Hello' to output.txt")]
 * }, config);
 *
 * // Check if agent is paused for approval
 * if (result.__interrupt__) {
 *   const interruptRequest = initialResult.__interrupt__?.[0] as Interrupt<
 *     HumanInTheLoopRequest[]
 *   >;
 *
 *   // Show tool call details to user
 *   console.log("Tool:", interruptRequest.value[0].actionRequest);
 *   console.log("Allowed actions:", interruptRequest.value[0].config);
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
 * new Command({ resume: [{ type: "response" }] })
 *
 * // Provide manual response
 * new Command({
 *   resume: [{
 *     type: "response",
 *     // this must be a string
 *     args: "File operation not allowed in demo mode"
 *   }]
 * })
 * ```
 *
 * @example
 * Production use case with database operations
 * ```typescript
 * const hitlMiddleware = humanInTheLoopMiddleware({
 *   interruptOn: {
 *     "execute_sql": {
 *       allowAccept: true,
 *       allowEdit: true,
 *       allowRespond: true,
 *       description: "🚨 SQL query requires DBA approval\nPlease review for safety and performance"
 *     },
 *     "read_schema": false  // Reading metadata is safe
 *     "delete_records": {
 *       allowAccept: true,
 *       description: "⛔ DESTRUCTIVE OPERATION - Requires manager approval"
 *     }
 *   },
 *   messagePrefix: "Database operation pending approval"
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
 *       allowAccept: true,
 *       allowEdit: true,
 *       // Use dynamic description that can access tool call, state, and runtime
 *       description: formatToolDescription
 *     },
 *     // Or use an inline function
 *     "send_email": {
 *       allowAccept: true,
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

      // Resolve per-tool configs (boolean true -> all actions allowed; false -> auto-approve)
      const resolvedToolConfigs: Record<string, ToolConfig> = {};
      for (const [toolName, toolConfig] of Object.entries(config.interruptOn)) {
        if (typeof toolConfig === "boolean") {
          if (toolConfig === true) {
            resolvedToolConfigs[toolName] = {
              allowAccept: true,
              allowEdit: true,
              allowRespond: true,
            };
          }
        } else {
          resolvedToolConfigs[toolName] = toolConfig as ToolConfig;
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

      const hitlRequests: HumanInTheLoopRequest[] = await Promise.all(
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
            actionRequest: { action: toolCall.name, args: toolCall.args },
            config: toolConfig,
            description,
          };
        })
      );

      const responses = (await interrupt(
        hitlRequests
      )) as HumanInTheLoopMiddlewareHumanResponse[];

      if (responses.length !== interruptToolCalls.length) {
        throw new Error(
          `Number of human responses (${responses.length}) does not match number of hanging tool calls (${interruptToolCalls.length}).`
        );
      }

      const approvedToolCalls: ToolCall[] = [...autoApprovedToolCalls];
      const artificialToolMessages: ToolMessage[] = [];

      for (const [i, response] of responses.entries()) {
        const toolCall = interruptToolCalls[i]!;
        const toolConfig = resolvedToolConfigs[toolCall.name]!;

        if (response.type === "accept" && toolConfig?.allowAccept) {
          approvedToolCalls.push(toolCall);
          continue;
        }

        if (response.type === "edit" && toolConfig?.allowEdit) {
          const edited = response.args;
          approvedToolCalls.push({
            id: toolCall.id,
            name: edited.action,
            args: edited.args,
          });
          continue;
        }

        if (response.type === "response" && toolConfig?.allowRespond) {
          const content =
            response.args ??
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

        const allowedActions = [
          toolConfig?.allowAccept && "accept",
          toolConfig?.allowEdit && "edit",
          toolConfig?.allowRespond && "response",
        ]
          .filter(Boolean)
          .join('", "');
        throw new Error(
          `Unexpected human response: ${JSON.stringify(
            response
          )}. Response action '${response.type}' is not allowed for tool '${
            toolCall.name
          }'. Expected one of: "${allowedActions}", based on the tool's configuration.`
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
