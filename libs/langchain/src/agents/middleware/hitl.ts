/* oxlint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod/v3";
import { z as z4 } from "zod/v4";
import { AIMessage, ToolMessage, ToolCall } from "@langchain/core/messages";
import {
  InferInteropZodInput,
  interopParse,
} from "@langchain/core/utils/types";
import { Command, interrupt, isCommand } from "@langchain/langgraph";

import { createMiddleware } from "../middleware.js";
import type { AgentBuiltInState, Runtime } from "../runtime.js";
import type { JumpToTarget } from "../constants.js";
import type { Interrupt } from "../types.js";
import type { ToolCallRequest } from "./types.js";

const WhenFunctionSchema = z
  .function()
  .args(z.custom<ToolCallRequest<AgentBuiltInState>>()) // request
  .returns(z.union([z.boolean(), z.promise(z.boolean())]));

/**
 * Predicate controlling whether a given tool call triggers an interrupt.
 *
 * Receives a {@link ToolCallRequest} and returns `true` to interrupt or `false`
 * to auto-approve the tool call.
 *
 * The request is constructed with `tool` set to `undefined` and `runtime` set to
 * the node-level {@link Runtime}, so it reflects the batch (`afterModel`) context
 * rather than a per-call tool execution. In `"per_call"` mode the predicate runs
 * in `wrapToolCall` and receives the real request, with `tool` set.
 *
 * In both modes the predicate runs again when the run resumes, so it must return
 * the same answer for the same call. If it returns `false` on resume, the
 * reviewer's answer is skipped and the tool runs, even if they rejected it.
 *
 * @param request - The tool call request being evaluated
 * @returns `true` to interrupt for the tool call, `false` to auto-approve it.
 * May also return a promise resolving to a boolean.
 *
 * @example
 * ```typescript
 * import { type WhenPredicate } from "langchain";
 *
 * // Only interrupt delete_file calls targeting /etc
 * const when: WhenPredicate = (request) =>
 *   String(request.toolCall.args.path ?? "").startsWith("/etc");
 * ```
 */
export type WhenPredicate = z.infer<typeof WhenFunctionSchema>;

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

/**
 * The type of decision a human can make.
 */
const ALLOWED_DECISIONS = ["approve", "edit", "reject"] as const;
const DecisionType = z.enum(ALLOWED_DECISIONS);
export type DecisionType = z.infer<typeof DecisionType>;

const InterruptOnConfigSchema = z.object({
  /**
   * The decisions that are allowed for this action.
   */
  allowedDecisions: z.array(DecisionType),
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
   * import type { InterruptOnConfig } from "langchain";
   *
   * const config: InterruptOnConfig = {
   *   allowedDecisions: ["approve", "reject"],
   *   description: "Please review this tool execution"
   * };
   * ```
   *
   * @example
   * Dynamic callable description
   * ```typescript
   * import type {
   *   AgentBuiltInState,
   *   Runtime,
   *   DescriptionFactory,
   *   ToolCall,
   *   InterruptOnConfig
   * } from "langchain";
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
  argsSchema: z.record(z.any()).optional(),
  /**
   * Optional predicate controlling whether to interrupt for a given tool call.
   *
   * Receives a {@link ToolCallRequest} and returns `true` to interrupt or
   * `false` to auto-approve the tool call.
   *
   * The request is constructed with `tool` set to `undefined` and `runtime` set
   * to the node-level {@link Runtime}, so `request.tool` is not available. In
   * `"per_call"` mode the predicate runs in `wrapToolCall` and receives the real
   * request, with `tool` set.
   *
   * @example
   * ```typescript
   * import type { InterruptOnConfig } from "langchain";
   *
   * // Only interrupt delete_file calls targeting /etc
   * const config: InterruptOnConfig = {
   *   allowedDecisions: ["approve", "reject"],
   *   when: (request) =>
   *     String(request.toolCall.args.path ?? "").startsWith("/etc"),
   * };
   * ```
   */
  when: WhenFunctionSchema.optional(),
});
export type InterruptOnConfig = z.input<typeof InterruptOnConfigSchema>;

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
  args: Record<string, any>;
}

/**
 * Represents an action request with a name, arguments, and description.
 */
export interface ActionRequest {
  /**
   * The name of the action being requested.
   */
  name: string;
  /**
   * Key-value pairs of arguments needed for the action (e.g., {"a": 1, "b": 2}).
   */
  args: Record<string, any>;
  /**
   * The description of the action to be reviewed.
   */
  description?: string;
}

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
   * JSON schema for the arguments associated with the action, if edits are allowed.
   */
  argsSchema?: Record<string, any>;
}

/**
 * Request for human feedback on a sequence of actions requested by a model.
 *
 * @example
 * ```ts
 * const hitlRequest: HITLRequest = {
 *   actionRequests: [
 *     { name: "send_email", args: { to: "user@example.com", subject: "Hello" } }
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
  actionRequests: ActionRequest[];
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

const ToolApprovalRequestSchema = z4.object({
  /** Always `"tool_approval"`; tells clients how to read this interrupt. */
  type: z4.literal("tool_approval"),
  /** ID of the model's tool call this approval is about. */
  tool_call_id: z4.string(),
  /** Tool name, as the model requested it. */
  name: z4.string(),
  /** Tool arguments, as the model requested them. */
  args: z4.record(z4.string(), z4.unknown()),
  /** Text shown to the reviewer. */
  description: z4.string(),
});

/**
 * Interrupt value raised once per gated tool call in `"per_call"` mode. Keys are
 * snake_case, as in Python.
 */
export type ToolApprovalRequest = z4.infer<typeof ToolApprovalRequestSchema>;

/**
 * What an edit's `args` must look like: the tool's schema if it's a Zod v4 object,
 * with unknown args rejected unless the tool accepts them (`z.looseObject`,
 * `.catchall()`). Any other tool takes any object, and checks it when it runs.
 */
function editArgs(
  tool?: ToolCallRequest["tool"]
): z4.ZodType<Record<string, unknown>> {
  const schema = tool && "schema" in tool ? tool.schema : undefined;
  if (!(schema instanceof z4.ZodObject)) {
    return z4.record(z4.string(), z4.unknown());
  }
  return schema.def.catchall ? schema : schema.strict();
}

/**
 * The answers a reviewer can give to a `"per_call"` approval of tool `name`, by type.
 *
 * The edit can't switch tools (its `name` is pinned), and unknown fields in it are
 * rejected, so a typo fails instead of being dropped.
 */
const toolApprovalDecisions = (
  name: string,
  tool?: ToolCallRequest["tool"]
) => ({
  approve: z4.object({ type: z4.literal("approve") }),
  edit: z4.strictObject({
    type: z4.literal("edit"),
    edited_action: z4.strictObject({
      name: z4.literal(name),
      args: editArgs(tool),
    }),
  }),
  reject: z4.object({
    type: z4.literal("reject"),
    message: z4.string().optional(),
  }),
});

/**
 * A reviewer's answer to a `"per_call"` tool approval.
 */
export type ToolApprovalDecision = z4.infer<
  ReturnType<typeof toolApprovalDecisions>[DecisionType]
>;

/**
 * Whether an interrupt is a `"per_call"` tool approval, e.g.
 * `result.__interrupt__?.filter(isToolApprovalInterrupt)`.
 */
export function isToolApprovalInterrupt(
  interrupt: Interrupt | undefined
): interrupt is Interrupt<ToolApprovalRequest> {
  return ToolApprovalRequestSchema.safeParse(interrupt?.value).success;
}

/**
 * The per-call `responseSchema`: the `allowed` decisions for tool `name`.
 *
 * An answer is checked only against the branch its `type` names, so a bad one gets a
 * single error. A one-decision tool gets that decision's plain object schema.
 */
function decisionSchema(
  allowed: readonly DecisionType[],
  name: string,
  tool?: ToolCallRequest["tool"]
): z4.ZodType<ToolApprovalDecision> {
  const byType = toolApprovalDecisions(name, tool);
  // Drop duplicates, keeping order: a discriminated union can't repeat a `type`.
  const [first, ...rest] = [...new Set(allowed)].map((d) => byType[d]);
  if (first === undefined) {
    throw new Error("allowedDecisions must list at least one decision.");
  }
  return rest.length ? z4.discriminatedUnion("type", [first, ...rest]) : first;
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
> & {
  /**
   * How the middleware pauses for review. Set at construction only.
   *
   * - `"batched"` (default): one interrupt per model turn for all gated tool calls.
   * - `"per_call"`: one {@link ToolApprovalRequest} interrupt per gated call, with a
   *   typed `responseSchema`. An invalid answer throws a `ZodError` and isn't saved.
   *   To answer several at once, check each against its `responseSchema` first, or
   *   send them one at a time. List this middleware before tool retry or
   *   error-handling middleware.
   */
  interruptMode?: "batched" | "per_call";
  /**
   * `"per_call"` mode only: text prepended to the result of a tool call a reviewer
   * edited, so the model knows the call it made isn't the one that ran. Pass `null`
   * to add nothing.
   */
  editNotice?: string | null;
};

const DEFAULT_EDIT_NOTICE =
  "Note: a human reviewer replaced this tool call before it ran. The call recorded in " +
  "your message is the one you produced, not the one that executed. This was " +
  "intentional and authorized. Do not re-issue your original call.";

/**
 * Resolve `interruptOn`: `true` allows all decisions; `false` and missing entries
 * auto-approve.
 */
function resolveInterruptOn(
  interruptOn: NonNullable<HumanInTheLoopMiddlewareConfig>["interruptOn"]
): Record<string, InterruptOnConfig> {
  const resolved: Record<string, InterruptOnConfig> = {};
  for (const [toolName, toolConfig] of Object.entries(interruptOn ?? {})) {
    if (typeof toolConfig === "boolean") {
      if (toolConfig === true) {
        resolved[toolName] = { allowedDecisions: [...ALLOWED_DECISIONS] };
      }
    } else if (toolConfig.allowedDecisions) {
      resolved[toolName] = toolConfig;
    }
  }
  return resolved;
}

/**
 * Return `message` with the reviewer-edit notice prepended, stating the call that ran.
 */
function prependNotice(
  message: ToolMessage,
  notice: string,
  executed: Action
): ToolMessage {
  const hasContent = message.content.length > 0;
  const text = `${notice} Executed instead: ${executed.name} with arguments ${JSON.stringify(
    executed.args
  )}.${hasContent ? "\n\nTool response:" : ""}`;
  return new ToolMessage({
    content:
      typeof message.content === "string"
        ? `${text}${hasContent ? "\n" : ""}${message.content}`
        : [{ type: "text", text }, ...message.content],
    tool_call_id: message.tool_call_id,
    name: message.name,
    status: message.status,
    artifact: message.artifact,
    id: message.id,
    additional_kwargs: message.additional_kwargs,
    response_metadata: message.response_metadata,
  });
}

/**
 * Tell the model a reviewer replaced the call, and with what.
 */
function withEditNotice(
  result: ToolMessage | Command,
  toolCallId: string,
  executed: Action,
  notice: string | null
): ToolMessage | Command {
  if (!notice) {
    return result;
  }
  if (ToolMessage.isInstance(result)) {
    return prependNotice(result, notice, executed);
  }
  // A `Command` carries the `ToolMessage` in its state update.
  const update: unknown = isCommand(result) ? result.update : undefined;
  if (
    typeof update !== "object" ||
    update === null ||
    !("messages" in update) ||
    !Array.isArray(update.messages)
  ) {
    return result;
  }
  return new Command({
    update: {
      ...update,
      messages: update.messages.map((message: unknown) =>
        ToolMessage.isInstance(message) && message.tool_call_id === toolCallId
          ? prependNotice(message, notice, executed)
          : message
      ),
    },
    resume: result.resume,
    goto: result.goto,
    graph: result.graph,
  });
}

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
 *         editedAction: { name: "write_file", args: { filename: "safe.txt", content: "Safe content" } }
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
 * @param options.interruptOn[toolName].argsSchema - JSON schema for the arguments associated with the action, if edits are allowed
 * @param options.interruptOn[toolName].when - Optional predicate that dynamically controls whether a tool call triggers an interrupt. Returns `true` to interrupt or `false` to auto-approve the tool call.
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
 *     editedAction: { name: "write_file", args: { filename: "safe.txt", content: "Modified" } }
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
 * - In the default `"batched"` mode, multiple tools requiring approval are bundled into a
 *   single interrupt request, raised in the `afterModel` phase before any tool runs. In
 *   `"per_call"` mode, each gated call raises its own interrupt from `wrapToolCall`
 * - Requires a checkpointer to maintain state across interruptions
 *
 * @see {@link createAgent} for agent creation
 * @see {@link Command} for resuming interrupted execution
 * @public
 */
export function humanInTheLoopMiddleware(
  options: NonNullable<HumanInTheLoopMiddlewareConfig>
) {
  const createActionAndConfig = async (
    toolCall: ToolCall,
    config: InterruptOnConfig,
    state: AgentBuiltInState,
    runtime: Runtime<unknown>
  ): Promise<{
    actionRequest: ActionRequest;
    reviewConfig: ReviewConfig;
  }> => {
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

    /**
     * Create ActionRequest with description
     */
    const actionRequest: ActionRequest = {
      name: toolName,
      args: toolArgs,
      description,
    };

    /**
     * Create ReviewConfig
     */
    const reviewConfig: ReviewConfig = {
      actionName: toolName,
      allowedDecisions: config.allowedDecisions,
    };

    if (config.argsSchema) {
      reviewConfig.argsSchema = config.argsSchema;
    }

    return { actionRequest, reviewConfig };
  };

  /**
   * Return `false` if the `when` predicate rejects this tool call, `true` otherwise.
   *
   * When no `when` predicate is configured the tool call always interrupts.
   */
  const shouldInterrupt = async (
    toolCall: ToolCall,
    config: InterruptOnConfig,
    state: AgentBuiltInState,
    runtime: Runtime<unknown>
  ): Promise<boolean> => {
    const { when } = config;
    if (when == null) {
      return true;
    }
    const request: ToolCallRequest<AgentBuiltInState> = {
      toolCall,
      tool: undefined,
      state,
      runtime,
    };
    return when(request);
  };

  const processDecision = (
    decision: Decision,
    toolCall: ToolCall,
    config: InterruptOnConfig
  ): { revisedToolCall: ToolCall | null; toolMessage: ToolMessage | null } => {
    const allowedDecisions = config.allowedDecisions;
    if (decision.type === "approve" && allowedDecisions.includes("approve")) {
      return { revisedToolCall: toolCall, toolMessage: null };
    }

    if (decision.type === "edit" && allowedDecisions.includes("edit")) {
      const editedAction = decision.editedAction;

      /**
       * Validate edited action structure
       */
      if (!editedAction || typeof editedAction.name !== "string") {
        throw new Error(
          `Invalid edited action for tool "${toolCall.name}": name must be a string`
        );
      }
      if (!editedAction.args || typeof editedAction.args !== "object") {
        throw new Error(
          `Invalid edited action for tool "${toolCall.name}": args must be an object`
        );
      }

      return {
        revisedToolCall: {
          type: "tool_call",
          name: editedAction.name,
          args: editedAction.args,
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

  const interruptMode = options.interruptMode ?? "batched";
  if (interruptMode !== "batched" && interruptMode !== "per_call") {
    throw new Error(
      `interruptMode must be "batched" or "per_call", got ${JSON.stringify(interruptMode)}.`
    );
  }
  if (interruptMode === "per_call") {
    for (const [toolName, toolConfig] of Object.entries(
      options.interruptOn ?? {}
    )) {
      if (
        typeof toolConfig === "object" &&
        !toolConfig.allowedDecisions?.length
      ) {
        throw new Error(
          `Invalid interruptOn config for tool "${toolName}": allowedDecisions must list at least one decision.`
        );
      }
    }
  }
  const editNotice =
    options.editNotice === undefined ? DEFAULT_EDIT_NOTICE : options.editNotice;

  return createMiddleware({
    name: "HumanInTheLoopMiddleware",
    contextSchema,
    /**
     * Per-call mode: pause for each gated tool call as it's about to run.
     */
    wrapToolCall:
      interruptMode === "per_call"
        ? async (request, handler) => {
            const { toolCall } = request;
            const { interruptOn } = interopParse(contextSchema, {
              ...options,
              ...(request.runtime.context || {}),
            });
            const toolConfig = resolveInterruptOn(interruptOn)[toolCall.name];
            if (
              !toolConfig ||
              (toolConfig.when && !(await toolConfig.when(request)))
            ) {
              return handler(request);
            }
            // Only a missing ID: an empty one still runs, as in batched mode.
            if (toolCall.id == null) {
              throw new Error(
                `Tool call \`${toolCall.name}\` has no ID, so its result can't be matched to it. Make sure the chat model returns tool call IDs.`
              );
            }
            const { actionRequest } = await createActionAndConfig(
              toolCall,
              toolConfig,
              request.state,
              request.runtime
            );
            const value: ToolApprovalRequest = {
              type: "tool_approval",
              tool_call_id: toolCall.id,
              name: toolCall.name,
              args: toolCall.args,
              description: actionRequest.description ?? "",
            };
            const responseSchema = decisionSchema(
              toolConfig.allowedDecisions,
              toolCall.name,
              request.tool
            );
            // LangGraph parses the answer against `responseSchema` before saving it, so
            // it comes back as one of this tool's allowed decisions.
            const decision = interrupt<
              ToolApprovalRequest,
              ToolApprovalDecision
            >(value, { responseSchema });
            if (decision.type === "approve") {
              return handler(request);
            }
            if (decision.type === "reject") {
              return new ToolMessage({
                content:
                  decision.message ??
                  `User rejected the tool call for \`${toolCall.name}\` with id ${toolCall.id}`,
                name: toolCall.name,
                tool_call_id: toolCall.id,
                status: "error",
              });
            }
            // The schema pinned the tool name, so this is always the same tool.
            const executed = decision.edited_action;
            const result = await handler({
              ...request,
              toolCall: { ...toolCall, args: executed.args },
            });
            return withEditNotice(result, toolCall.id, executed, editNotice);
          }
        : undefined,
    afterModel: {
      canJumpTo: ["model"],
      hook: async (state, runtime) => {
        if (interruptMode === "per_call") {
          // Interrupts are raised per tool call, in `wrapToolCall`.
          return;
        }
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

        /**
         * Resolve per-tool configs (boolean true -> all decisions allowed; false -> auto-approve)
         */
        const resolvedConfigs = resolveInterruptOn(config.interruptOn);

        const interruptToolCalls: ToolCall[] = [];
        const autoApprovedToolCalls: ToolCall[] = [];

        for (const toolCall of lastMessage.tool_calls) {
          const interruptConfig = resolvedConfigs[toolCall.name];
          /**
           * A tool call is interrupted only when it has a resolved config and its
           * optional `when` predicate doesn't opt it out. Otherwise it is
           * auto-approved.
           */
          if (
            interruptConfig &&
            (await shouldInterrupt(toolCall, interruptConfig, state, runtime))
          ) {
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

        /**
         * Create action requests and review configs for all tools that need approval
         */
        const actionRequests: ActionRequest[] = [];
        const reviewConfigs: ReviewConfig[] = [];

        for (const toolCall of interruptToolCalls) {
          const interruptConfig = resolvedConfigs[toolCall.name]!;

          /**
           * Create ActionRequest and ReviewConfig using helper method
           */
          const { actionRequest, reviewConfig } = await createActionAndConfig(
            toolCall,
            interruptConfig,
            state,
            runtime
          );
          actionRequests.push(actionRequest);
          reviewConfigs.push(reviewConfig);
        }

        /**
         * Create single HITLRequest with all actions and configs
         */
        const hitlRequest: HITLRequest = {
          actionRequests,
          reviewConfigs,
        };

        /**
         * Send interrupt and get response
         */
        const hitlResponse = (await interrupt(hitlRequest)) as HITLResponse;
        const decisions = hitlResponse.decisions;

        /**
         * Validate that decisions is a valid array before checking length
         */
        if (!decisions || !Array.isArray(decisions)) {
          throw new Error(
            "Invalid HITLResponse: decisions must be a non-empty array"
          );
        }

        /**
         * Validate that the number of decisions matches the number of interrupt tool calls
         */
        if (decisions.length !== interruptToolCalls.length) {
          throw new Error(
            `Number of human decisions (${decisions.length}) does not match number of hanging tool calls (${interruptToolCalls.length}).`
          );
        }

        const revisedToolCalls: ToolCall[] = [...autoApprovedToolCalls];
        const artificialToolMessages: ToolMessage[] = [];
        const hasRejectedToolCalls = decisions.some(
          (decision) => decision.type === "reject"
        );

        /**
         * Process each decision using helper method
         */
        for (let i = 0; i < decisions.length; i++) {
          const decision = decisions[i]!;
          const toolCall = interruptToolCalls[i]!;
          const interruptConfig = resolvedConfigs[toolCall.name]!;

          const { revisedToolCall, toolMessage } = processDecision(
            decision,
            toolCall,
            interruptConfig
          );

          if (
            revisedToolCall &&
            /**
             * If any decision is a rejected, we are going back to the model
             * with only the tool calls that were rejected as we don't know
             * the results of the approved/updated tool calls at this point.
             */
            (!hasRejectedToolCalls || decision.type === "reject")
          ) {
            revisedToolCalls.push(revisedToolCall);
          }
          if (toolMessage) {
            artificialToolMessages.push(toolMessage);
          }
        }

        /**
         * Update the AI message to only include approved tool calls
         */
        if (AIMessage.isInstance(lastMessage)) {
          lastMessage.tool_calls = revisedToolCalls;
        }

        const jumpTo: JumpToTarget | undefined = hasRejectedToolCalls
          ? "model"
          : undefined;
        return {
          messages: [lastMessage, ...artificialToolMessages],
          jumpTo,
        };
      },
    },
  });
}
