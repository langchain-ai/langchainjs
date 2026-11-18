import { z } from "zod/v3";
import { AIMessage } from "@langchain/core/messages";

import { createMiddleware } from "../middleware.js";

export interface ModelCallBudgetMiddlewareConfig {
  /** Nonnegative number of working model turns, excluding the reserved final turn. */
  runLimit: number;
}

/** Expose a per-invocation model-turn budget and reserve one tool-free final response. */
export function modelCallBudgetMiddleware({
  runLimit,
}: ModelCallBudgetMiddlewareConfig) {
  if (!Number.isSafeInteger(runLimit) || runLimit < 0) {
    throw new Error("runLimit must be a nonnegative safe integer");
  }

  return createMiddleware({
    name: "ModelCallBudgetMiddleware",
    stateSchema: z.object({ modelBudgetUsed: z.number().default(0) }),
    beforeAgent: () => ({ modelBudgetUsed: 0 }),
    wrapModelCall: async (request, handler) => {
      const used = request.state.modelBudgetUsed;
      const remaining = Math.max(0, runLimit - used);
      const finish =
        remaining === 0
          ? " The working budget is exhausted. Provide your final answer now using the evidence already collected. State any limitations. Do not call tools."
          : "";
      const notice = `Model-call budget: ${used}/${runLimit} working turns used; ${remaining} remaining. One additional tool-free final response is reserved.${finish}`;
      const systemMessage = request.systemMessage.concat(`\n\n${notice}`);
      const modelSettings = Object.fromEntries(
        Object.entries(request.modelSettings ?? {}).filter(
          ([key]) => !["tools", "tool_choice", "response_format"].includes(key)
        )
      );
      const response = await handler({
        ...request,
        systemMessage,
        ...(remaining === 0
          ? {
              tools: [],
              toolChoice: undefined,
              responseFormat: undefined,
              modelSettings,
            }
          : {}),
      });
      if (
        remaining === 0 &&
        response instanceof AIMessage &&
        (response.tool_calls?.length || response.invalid_tool_calls?.length)
      ) {
        throw new Error(
          "The budget final response must not contain tool calls"
        );
      }
      return response;
    },
    afterModel: {
      canJumpTo: ["end"],
      hook: (state) => {
        const modelBudgetUsed = state.modelBudgetUsed + 1;
        return {
          modelBudgetUsed,
          ...(modelBudgetUsed > runLimit ? { jumpTo: "end" as const } : {}),
        };
      },
    },
  });
}
