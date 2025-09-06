import { RunnableConfig } from "@langchain/core/runnables";
import { type ZodIssue } from "zod";

import type {
  AgentMiddleware,
  Runtime,
  AgentBuiltInState,
  ModelRequest,
} from "../types.js";

/**
 * Helper function to execute prepareModelRequest hooks from all middlewares.
 * This is used within AgentNode before the model is invoked.
 */
export async function executePrepareCallHooks(
  middlewares: readonly AgentMiddleware<any, any, any>[],
  options: ModelRequest,
  state: AgentBuiltInState,
  config?: RunnableConfig
): Promise<ModelRequest> {
  let currentOptions = { ...options };
  const runtime: Runtime<any> = {
    toolCalls: [],
    toolResults: [],
    tokenUsage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    },
    context: config?.configurable?.context || {},
    currentIteration: 0,
  };

  // Execute prepareModelRequest hooks in order
  for (const middleware of middlewares) {
    if (middleware.prepareModelRequest) {
      const result = await middleware.prepareModelRequest(
        currentOptions,
        state,
        runtime
      );
      if (result) {
        currentOptions = { ...currentOptions, ...result };
      }
    }
  }

  return currentOptions;
}

/**
 * Helper function to initialize middleware state defaults.
 * This is used to ensure all middleware state properties are initialized.
 */
export function initializeMiddlewareStates(
  middlewares: readonly AgentMiddleware<any, any, any>[],
  state: unknown
): Record<string, any> {
  const middlewareStates: Record<string, any> = {};

  for (const middleware of middlewares) {
    if (middleware.stateSchema) {
      // Use safeParse to avoid errors with required fields
      const parseResult = middleware.stateSchema.safeParse(state);

      if (parseResult.success) {
        // Only use default values if the schema allows empty objects
        Object.assign(middlewareStates, parseResult.data);
        continue;
      }

      /**
       * If safeParse fails, we throw a nice error message
       */
      const requiredFields = parseResult.error.issues
        .filter(
          (issue: ZodIssue) =>
            issue.code === "invalid_type" && issue.message === "Required"
        )
        .map(
          (issue: ZodIssue) => `  - ${issue.path.join(".")}: ${issue.message}`
        )
        .join("\n");

      throw new Error(
        `Middleware "${middleware.name}" has required state fields that must be initialized:\n` +
          `${requiredFields}\n\n` +
          `To fix this, either:\n` +
          `1. Provide default values in your middleware's state schema using .default():\n` +
          `   stateSchema: z.object({\n` +
          `     myField: z.string().default("default value")\n` +
          `   })\n\n` +
          `2. Or make the fields optional using .optional():\n` +
          `   stateSchema: z.object({\n` +
          `     myField: z.string().optional()\n` +
          `   })\n\n` +
          `3. Or ensure you pass these values when invoking the agent:\n` +
          `   agent.invoke({\n` +
          `     messages: [...],\n` +
          `     ${parseResult.error.issues[0]?.path.join(".")}: "value"\n` +
          `   })`
      );
    }
  }

  return middlewareStates;
}
