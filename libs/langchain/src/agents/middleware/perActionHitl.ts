import { z } from "zod/v3";
import { AIMessage, ToolCall, ToolMessage } from "@langchain/core/messages";
import { interopParse } from "@langchain/core/utils/types";
import { interrupt } from "@langchain/langgraph";

import { createMiddleware } from "../middleware.js";
import type { AgentBuiltInState, Runtime } from "../runtime.js";
import type {
  ActionRequest,
  Decision,
  HITLRequest,
  HITLResponse,
  HumanInTheLoopMiddlewareConfig,
  InterruptOnConfig,
  ReviewConfig,
} from "./hitl.js";

const ALLOWED_DECISIONS = ["approve", "edit", "reject"] as const;
const DecisionType = z.enum(ALLOWED_DECISIONS);

const DescriptionFunctionSchema = z
  .function()
  .args(
    z.custom<ToolCall>(),
    z.custom<AgentBuiltInState>(),
    z.custom<Runtime<unknown>>()
  )
  .returns(z.union([z.string(), z.promise(z.string())]));

const InterruptOnConfigSchema = z.object({
  allowedDecisions: z.array(DecisionType),
  description: z.union([z.string(), DescriptionFunctionSchema]).optional(),
  argsSchema: z.record(z.any()).optional(),
});

const contextSchema = z.object({
  interruptOn: z
    .record(z.union([z.boolean(), InterruptOnConfigSchema]))
    .optional(),
  descriptionPrefix: z.string().default("Tool execution requires approval"),
});

/**
 * Configuration for `perActionHumanInTheLoopMiddleware`.
 *
 * Uses the same configuration shape as `humanInTheLoopMiddleware`.
 */
export type PerActionHumanInTheLoopMiddlewareConfig =
  HumanInTheLoopMiddlewareConfig;

/**
 * Per-Action Human-in-the-Loop middleware.
 *
 * This middleware keeps the same interrupt contract as the built-in HITL middleware
 * (single batch interrupt with ordered per-action decisions), but changes one key
 * execution semantic:
 *
 * - Approve/Edit actions remain executable even when other actions in the same batch
 *   are rejected.
 * - Reject actions are converted into synthetic `ToolMessage(status="error")` entries
 *   tied to the rejected `tool_call_id`.
 *
 * Unlike strict HITL, this middleware does not force a `jumpTo: "model"` when any
 * decision is rejected.
 */
export function perActionHumanInTheLoopMiddleware(
  options: NonNullable<PerActionHumanInTheLoopMiddlewareConfig>
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

    const actionRequest: ActionRequest = {
      name: toolName,
      args: toolArgs,
      description,
    };

    const reviewConfig: ReviewConfig = {
      actionName: toolName,
      allowedDecisions: config.allowedDecisions,
    };

    if (config.argsSchema) {
      reviewConfig.argsSchema = config.argsSchema;
    }

    return { actionRequest, reviewConfig };
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

      const content =
        decision.message ??
        `User rejected the tool call for \`${toolCall.name}\` with id ${toolCall.id}`;

      const toolMessage = new ToolMessage({
        content,
        name: toolCall.name,
        tool_call_id: toolCall.id!,
        status: "error",
      });

      // Keep the original tool call in the AI message so the transcript remains
      // faithful; the synthetic ToolMessage marks it as resolved.
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
    name: "PerActionHumanInTheLoopMiddleware",
    contextSchema,
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

      const lastMessage = [...messages]
        .reverse()
        .find((msg) => AIMessage.isInstance(msg)) as AIMessage;
      if (!lastMessage || !lastMessage.tool_calls?.length) {
        return;
      }

      if (!config.interruptOn) {
        return;
      }

      const resolvedConfigs: Record<string, InterruptOnConfig> = {};
      for (const [toolName, toolConfig] of Object.entries(config.interruptOn)) {
        if (typeof toolConfig === "boolean") {
          if (toolConfig === true) {
            resolvedConfigs[toolName] = {
              allowedDecisions: [...ALLOWED_DECISIONS],
            };
          }
        } else if (toolConfig.allowedDecisions) {
          resolvedConfigs[toolName] = toolConfig as InterruptOnConfig;
        }
      }

      const interruptToolCalls: ToolCall[] = [];
      const interruptIndices: number[] = [];
      for (const [idx, toolCall] of lastMessage.tool_calls.entries()) {
        if (toolCall.name in resolvedConfigs) {
          interruptToolCalls.push(toolCall);
          interruptIndices.push(idx);
        }
      }

      if (!interruptToolCalls.length) {
        return;
      }

      const actionRequests: ActionRequest[] = [];
      const reviewConfigs: ReviewConfig[] = [];

      for (const toolCall of interruptToolCalls) {
        const interruptConfig = resolvedConfigs[toolCall.name]!;
        const { actionRequest, reviewConfig } = await createActionAndConfig(
          toolCall,
          interruptConfig,
          state,
          runtime
        );
        actionRequests.push(actionRequest);
        reviewConfigs.push(reviewConfig);
      }

      const hitlRequest: HITLRequest = {
        actionRequests,
        reviewConfigs,
      };
      const hitlResponse = (await interrupt(hitlRequest)) as HITLResponse;
      const decisions = hitlResponse.decisions;

      if (!decisions || !Array.isArray(decisions)) {
        throw new Error(
          "Invalid HITLResponse: decisions must be a non-empty array"
        );
      }
      if (decisions.length !== interruptToolCalls.length) {
        throw new Error(
          `Number of human decisions (${decisions.length}) does not match number of hanging tool calls (${interruptToolCalls.length}).`
        );
      }

      const interruptIndexSet = new Set(interruptIndices);
      const revisedToolCalls: ToolCall[] = [];
      const artificialToolMessages: ToolMessage[] = [];
      let decisionCursor = 0;

      for (const [idx, toolCall] of lastMessage.tool_calls.entries()) {
        if (!interruptIndexSet.has(idx)) {
          revisedToolCalls.push(toolCall);
          continue;
        }

        const decision = decisions[decisionCursor]!;
        decisionCursor += 1;
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

      lastMessage.tool_calls = revisedToolCalls;

      return {
        messages: [lastMessage, ...artificialToolMessages],
      };
    },
  });
}

/**
 * Short alias for `perActionHumanInTheLoopMiddleware`.
 */
export const paHitlMiddleware = perActionHumanInTheLoopMiddleware;
