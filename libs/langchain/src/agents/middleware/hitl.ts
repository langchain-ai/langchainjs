/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod/v3";
import { AIMessage, ToolMessage, ToolCall } from "@langchain/core/messages";
import {
  InferInteropZodInput,
  interopParse,
} from "@langchain/core/utils/types";
import { interrupt } from "@langchain/langgraph";

import { createMiddleware } from "../middleware.js";
import type { AgentBuiltInState, Runtime } from "../runtime.js";

const DescriptionFunctionSchema = z
  .function()
  .args(
    z.custom<ToolCall>(), // toolCall
    z.custom<AgentBuiltInState>(), // state
    z.custom<Runtime<unknown>>() // runtime
  )
  .returns(z.union([z.string(), z.promise(z.string())]));

/**
 * Function type that dynamically generates a description for a tool call approval request.
 *
 * @param toolCall - The tool call being reviewed
 * @param state - The current agent state
 * @param runtime - The agent runtime context
 * @returns A string description or Promise that resolves to a string description
 *
 * @example
 * ```typescript
 * import { type DescriptionFactory, type ToolCall } from "langchain";
 *
 * const descriptionFactory: DescriptionFactory = (toolCall, state, runtime) => {
 *   return `Please review: ${toolCall.name}(${JSON.stringify(toolCall.args)})`;
 * };
 * ```
 */
export type DescriptionFactory = z.infer<typeof DescriptionFunctionSchema>;

const InterruptOnConfigSchema = z.object({
  /**
   * The decisions that are allowed for this action.
   */
  allowedDecisions: z.array(z.enum(["approve", "edit", "reject"])).optional(),
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
   * const config: InterruptOnConfig = {
   *   allowedDecisions: ["approve", "reject"],
   *   description: "Please review this tool execution"
   * };
   * ```
   *
   * @example
   * Dynamic callable description
   * ```typescript
   * import { type DescriptionFactory, type ToolCall } from "langchain";
   * import type { AgentBuiltInState, Runtime } from "langchain/agents";
   *
   * const formatToolDescription: DescriptionFactory = (
   *   toolCall: ToolCall,
   *   state: AgentBuiltInState,
   *   runtime: Runtime<unknown>
   * ) => {
   *   return `Tool: ${toolCall.name}\nArguments:\n${JSON.stringify(toolCall.args, null, 2)}`;
   * };
   *
   * const config: InterruptOnConfig = {
   *   allowedDecisions: ["approve", "edit"],
   *   description: formatToolDescription
   * };
   * ```
   */
  description: z.union([z.string(), DescriptionFunctionSchema]).optional(),
  /**
   * JSON schema for the arguments associated with the action, if edits are allowed.
   */
  argumentsSchema: z.record(z.any()).optional(),
});

type InterruptOnConfigSchema = z.input<typeof InterruptOnConfigSchema>;

/**
 * Represents an action with a name and arguments.
 */
export interface Action {
  /**
   * The type or name of action being requested (e.g., "add_numbers").
   */
  name: string;
  /**
   * Key-value pairs of arguments needed for the action (e.g., {"a": 1, "b": 2}).
   */
  arguments: Record<string, any>;
}

/**
 * The type of decision a human can make.
 */
export type DecisionType = "approve" | "edit" | "reject";
const ALLOWED_DECISIONS: DecisionType[] = ["approve", "edit", "reject"];

/**
 * Policy for reviewing a HITL request.
 */
export interface ReviewConfig {
  /**
   * Name of the action associated with this review configuration.
   */
  actionName: string;
  /**
   * The decisions that are allowed for this request.
   */
  allowedDecisions: DecisionType[];
  /**
   * The description of the action to be reviewed.
   */
  description?: string;
  /**
   * JSON schema for the arguments associated with the action, if edits are allowed.
   */
  argumentsSchema?: Record<string, any>;
}

/**
 * Request for human feedback on a sequence of actions requested by a model.
 *
 * @example
 * ```ts
 * const hitlRequest: HITLRequest = {
 *   actionRequests: [
 *     { name: "send_email", arguments: { to: "user@example.com", subject: "Hello" } }
 *   ],
 *   reviewConfigs: [
 *     {
 *       actionName: "send_email",
 *       allowedDecisions: ["approve", "edit", "reject"],
 *       description: "Please review the email before sending"
 *     }
 *   ]
 * };
 * const response = interrupt(hitlRequest);
 * ```
 */
export interface HITLRequest {
  /**
   * A list of agent actions for human review.
   */
  actionRequests: Action[];
  /**
   * Review configuration for all possible actions.
   */
  reviewConfigs: ReviewConfig[];
}

/**
 * Response when a human approves the action.
 */
export interface ApproveDecision {
  type: "approve";
}

/**
 * Response when a human edits the action.
 */
export interface EditDecision {
  type: "edit";
  /**
   * Edited action for the agent to perform.
   * Ex: for a tool call, a human reviewer can edit the tool name and args.
   */
  editedAction: Action;
}

/**
 * Response when a human rejects the action.
 */
export interface RejectDecision {
  type: "reject";
  /**
   * The message sent to the model explaining why the action was rejected.
   */
  message?: string;
}

/**
 * Union of all possible decision types.
 */
export type Decision = ApproveDecision | EditDecision | RejectDecision;

/**
 * Response payload for a HITLRequest.
 */
export interface HITLResponse {
  /**
   * The decisions made by the human.
   */
  decisions: Decision[];
}

/**
 * Configuration for an action requiring human in the loop.
 * This is the configuration format used in the `humanInTheLoopMiddleware` function.
 *
 * @example
 * ```typescript
 * const config: InterruptOnConfig = {
 *   allowedDecisions: ["approve", "edit"],
 *   description: "Please review this operation",
 *   argumentsSchema: {
 *     type: "object",
 *     properties: {
 *       filename: { type: "string" },
 *       content: { type: "string" }
 *     }
 *   }
 * };
 * ```
 */
export interface InterruptOnConfig {
  /**
   * The decisions that are allowed for this action.
   * Defaults to `["approve", "edit", "reject"]` if not specified.
   */
  allowedDecisions?: DecisionType[];
  /**
   * Human-facing description shown in the approval request.
   * Can be either:
   * - A static string describing the approval request
   * - A {@link DescriptionFactory} function that dynamically generates the description
   *   based on the tool call, agent state, and runtime context
   */
  description?: string | DescriptionFactory;
  /**
   * JSON schema for the arguments associated with the action, if edits are allowed.
   * Used to validate and provide structure for edited tool arguments.
   */
  argumentsSchema?: Record<string, any>;
}

const contextSchema = z.object({
  /**
   * Mapping of tool name to allowed reviewer responses.
   * If a tool doesn't have an entry, it's auto-approved by default.
   *
   * - `true` -> pause for approval and allow approve/edit/reject decisions
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
   * `description` via their {@link InterruptOnConfig}. If a tool specifies a custom
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
 * property that contains the interrupt request.
 *
 * ```ts
 * import { type HITLRequest, type HITLResponse } from "langchain";
 * import { type Interrupt } from "langchain";
 *
 * const result = await agent.invoke(request);
 * const interruptRequest = result.__interrupt__?.[0] as Interrupt<HITLRequest>;
 *
 * // Examine the action requests and review configs
 * const actionRequests = interruptRequest.value.actionRequests;
 * const reviewConfigs = interruptRequest.value.reviewConfigs;
 *
 * // Create decisions for each action
 * const resume: HITLResponse = {
 *   decisions: actionRequests.map((action, i) => {
 *     if (action.name === "calculator") {
 *       return { type: "approve" };
 *     } else if (action.name === "write_file") {
 *       return {
 *         type: "edit",
 *         editedAction: { name: "write_file", arguments: { filename: "safe.txt", content: "Safe content" } }
 *       };
 *     }
 *     return { type: "reject", message: "Action not allowed" };
 *   })
 * };
 *
 * // Resume with decisions
 * await agent.invoke(new Command({ resume }), config);
 * ```
 *
 * ## Features
 *
 * - **Selective Tool Approval**: Configure which tools require human approval
 * - **Multiple Decision Types**: Approve, edit, or reject tool calls
 * - **Asynchronous Workflow**: Uses LangGraph's interrupt mechanism for non-blocking approval
 * - **Custom Approval Messages**: Provide context-specific descriptions for approval requests
 *
 * ## Decision Types
 *
 * When a tool requires approval, the human operator can respond with:
 * - `approve`: Execute the tool with original arguments
 * - `edit`: Modify the tool name and/or arguments before execution
 * - `reject`: Provide a manual response instead of executing the tool
 *
 * @param options - Configuration options for the middleware
 * @param options.interruptOn - Per-tool configuration mapping tool names to their settings
 * @param options.interruptOn[toolName].allowedDecisions - Array of decision types allowed for this tool (e.g., ["approve", "edit", "reject"])
 * @param options.interruptOn[toolName].description - Custom approval message for the tool. Can be either a static string or a callable that dynamically generates the description based on agent state, runtime, and tool call information
 * @param options.interruptOn[toolName].argumentsSchema - JSON schema for the arguments associated with the action, if edits are allowed
 * @param options.descriptionPrefix - Default prefix for approval messages (default: "Tool execution requires approval"). Only used for tools that do not define a custom `description` in their InterruptOnConfig.
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
 *       allowedDecisions: ["approve", "edit"],
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
 * import { type HITLRequest, type HITLResponse, type Interrupt } from "langchain";
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
 *   const resume: HITLResponse = {
 *     decisions: [{ type: "approve" }]
 *   };
 *   await agent.invoke(
 *     new Command({ resume }),
 *     config
 *   );
 * }
 * ```
 *
 * @example
 * Different decision types
 * ```typescript
 * import { type HITLResponse } from "langchain";
 *
 * // Approve the tool call as-is
 * const resume: HITLResponse = {
 *   decisions: [{ type: "approve" }]
 * };
 *
 * // Edit the tool arguments
 * const resume: HITLResponse = {
 *   decisions: [{
 *     type: "edit",
 *     editedAction: { name: "write_file", arguments: { filename: "safe.txt", content: "Modified" } }
 *   }]
 * };
 *
 * // Reject with feedback
 * const resume: HITLResponse = {
 *   decisions: [{
 *     type: "reject",
 *     message: "File operation not allowed in demo mode"
 *   }]
 * };
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
 *     "read_schema": false,  // Reading metadata is safe
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
 * import { type DescriptionFactory, type ToolCall } from "langchain";
 * import type { AgentBuiltInState, Runtime } from "langchain/agents";
 *
 * // Define a dynamic description factory
 * const formatToolDescription: DescriptionFactory = (
 *   toolCall: ToolCall,
 *   state: AgentBuiltInState,
 *   runtime: Runtime<unknown>
 * ) => {
 *   return `Tool: ${toolCall.name}\nArguments:\n${JSON.stringify(toolCall.args, null, 2)}`;
 * };
 *
 * const hitlMiddleware = humanInTheLoopMiddleware({
 *   interruptOn: {
 *     "write_file": {
 *       allowedDecisions: ["approve", "edit"],
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
 * - Multiple tools requiring approval are bundled into a single interrupt request
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
  const createReviewConfig = async (
    toolCall: ToolCall,
    config: InterruptOnConfig,
    state: AgentBuiltInState,
    runtime: Runtime<unknown>
  ): Promise<ReviewConfig> => {
    const toolName = toolCall.name;
    const toolArgs = toolCall.args;

    // Generate description using the description field (str or callable)
    const descriptionValue = config.description;
    let description: string;
    if (typeof descriptionValue === "function") {
      description = await descriptionValue(toolCall, state, runtime);
    } else if (descriptionValue !== undefined) {
      description = descriptionValue;
    } else {
      description = `${
        options.descriptionPrefix ?? "Tool execution requires approval"
      }\n\nTool: ${toolName}\nArgs: ${JSON.stringify(toolArgs, null, 2)}`;
    }

    const reviewConfig: ReviewConfig = {
      actionName: toolName,
      allowedDecisions: config.allowedDecisions ?? ALLOWED_DECISIONS,
      description,
    };

    if (config.argumentsSchema) {
      reviewConfig.argumentsSchema = config.argumentsSchema;
    }

    return reviewConfig;
  };

  const processDecision = (
    decision: Decision,
    toolCall: ToolCall,
    config: InterruptOnConfig
  ): { revisedToolCall: ToolCall | null; toolMessage: ToolMessage | null } => {
    const allowedDecisions = config.allowedDecisions ?? ALLOWED_DECISIONS;
    if (decision.type === "approve" && allowedDecisions.includes("approve")) {
      return { revisedToolCall: toolCall, toolMessage: null };
    }

    if (decision.type === "edit" && allowedDecisions.includes("edit")) {
      const editedAction = decision.editedAction;
      return {
        revisedToolCall: {
          type: "tool_call",
          name: editedAction.name,
          args: editedAction.arguments,
          id: toolCall.id,
        },
        toolMessage: null,
      };
    }

    if (decision.type === "reject" && allowedDecisions.includes("reject")) {
      /**
       * Validate that message is a string if provided
       */
      if (
        decision.message !== undefined &&
        typeof decision.message !== "string"
      ) {
        throw new Error(
          `Tool call response for "${
            toolCall.name
          }" must be a string, got ${typeof decision.message}`
        );
      }

      // Create a tool message with the human's text response
      const content =
        decision.message ??
        `User rejected the tool call for \`${toolCall.name}\` with id ${toolCall.id}`;

      const toolMessage = new ToolMessage({
        content,
        name: toolCall.name,
        tool_call_id: toolCall.id!,
        status: "error",
      });

      return { revisedToolCall: toolCall, toolMessage };
    }

    const msg = `Unexpected human decision: ${JSON.stringify(
      decision
    )}. Decision type '${decision.type}' is not allowed for tool '${
      toolCall.name
    }'. Expected one of ${JSON.stringify(
      allowedDecisions
    )} based on the tool's configuration.`;
    throw new Error(msg);
  };

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
      const resolvedConfigs: Record<string, InterruptOnConfig> = {};
      for (const [toolName, toolConfig] of Object.entries(config.interruptOn)) {
        if (typeof toolConfig === "boolean") {
          if (toolConfig === true) {
            resolvedConfigs[toolName] = {
              allowedDecisions: ALLOWED_DECISIONS,
            };
          }
        } else if (
          typeof toolConfig === "object" &&
          toolConfig !== null &&
          "allowedDecisions" in toolConfig &&
          toolConfig.allowedDecisions
        ) {
          resolvedConfigs[toolName] = toolConfig as InterruptOnConfig;
        }
      }

      const interruptToolCalls: ToolCall[] = [];
      const autoApprovedToolCalls: ToolCall[] = [];

      for (const toolCall of lastMessage.tool_calls) {
        if (toolCall.name in resolvedConfigs) {
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

      // Create action requests and review configs for all tools that need approval
      const actionRequests: Action[] = [];
      const reviewConfigs: ReviewConfig[] = [];

      for (const toolCall of interruptToolCalls) {
        const toolName = toolCall.name;
        const toolArgs = toolCall.args;
        const interruptConfig = resolvedConfigs[toolName]!;

        // Create Action
        const action: Action = { name: toolName, arguments: toolArgs };
        actionRequests.push(action);

        // Create ReviewConfig using helper method
        const reviewConfig = await createReviewConfig(
          toolCall,
          interruptConfig,
          state,
          runtime
        );
        reviewConfigs.push(reviewConfig);
      }

      // Create single HITLRequest with all actions and configs
      const hitlRequest: HITLRequest = {
        actionRequests,
        reviewConfigs,
      };

      // Send interrupt and get response
      const hitlResponse = (await interrupt(hitlRequest)) as HITLResponse;
      const decisions = hitlResponse.decisions;

      // Validate that the number of decisions matches the number of interrupt tool calls
      if (decisions.length !== interruptToolCalls.length) {
        throw new Error(
          `Number of human decisions (${decisions.length}) does not match number of hanging tool calls (${interruptToolCalls.length}).`
        );
      }

      const revisedToolCalls: ToolCall[] = [...autoApprovedToolCalls];
      const artificialToolMessages: ToolMessage[] = [];

      // Process each decision using helper method
      for (let i = 0; i < decisions.length; i++) {
        const decision = decisions[i]!;
        const toolCall = interruptToolCalls[i]!;
        const interruptConfig = resolvedConfigs[toolCall.name]!;

        const { revisedToolCall, toolMessage } = processDecision(
          decision,
          toolCall,
          interruptConfig
        );

        if (revisedToolCall) {
          revisedToolCalls.push(revisedToolCall);
        }
        if (toolMessage) {
          artificialToolMessages.push(toolMessage);
        }
      }

      // Update the AI message to only include approved tool calls
      if (AIMessage.isInstance(lastMessage)) {
        lastMessage.tool_calls = revisedToolCalls;
      }

      if (revisedToolCalls.length > 0) {
        return { messages: [...state.messages, ...artificialToolMessages] };
      }

      return {
        jumpTo: "model",
        messages: [...state.messages, ...artificialToolMessages],
      };
    },
  });
}
