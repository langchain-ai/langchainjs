/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod/v3";
import { type BaseMessage } from "@langchain/core/messages";
import {
  interopSafeParseAsync,
  interopZodObjectMakeFieldsOptional,
} from "@langchain/core/utils/types";
import { type ZodIssue } from "zod/v3";
import { END } from "@langchain/langgraph";

import type { AgentMiddleware, JumpTo } from "../types.js";

/**
 * Helper function to initialize middleware state defaults.
 * This is used to ensure all middleware state properties are initialized.
 *
 * Private properties (starting with _) are automatically made optional since
 * users cannot provide them when invoking the agent.
 */
export async function initializeMiddlewareStates(
  middlewareList: readonly AgentMiddleware<any, any, any>[],
  state: unknown
): Promise<Record<string, any>> {
  const middlewareStates: Record<string, any> = {};

  for (const middleware of middlewareList) {
    if (middleware.stateSchema) {
      // Create a modified schema where private properties are optional
      const modifiedSchema = interopZodObjectMakeFieldsOptional(
        middleware.stateSchema,
        (key) => key.startsWith("_")
      );

      // Use safeParse with the modified schema
      const parseResult = await interopSafeParseAsync(modifiedSchema, state);

      if (parseResult.success) {
        Object.assign(middlewareStates, parseResult.data);
        continue;
      }

      /**
       * If safeParse fails, there are required public fields missing
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

/**
 * Users can define private and public state for a middleware. Private state properties start with an underscore.
 * This function will return the private state properties from the state schema, making all of them optional.
 * @param stateSchema - The middleware state schema
 * @returns A new schema containing only the private properties (underscore-prefixed), all made optional
 */
export function derivePrivateState(
  stateSchema?: z.ZodObject<z.ZodRawShape>
): z.ZodObject<z.ZodRawShape> {
  const builtInStateSchema = {
    messages: z.custom<BaseMessage[]>(() => []),
  };

  if (!stateSchema) {
    return z.object(builtInStateSchema);
  }

  const { shape } = stateSchema;
  const privateShape: Record<string, any> = builtInStateSchema;

  // Filter properties that start with underscore and make them optional
  for (const [key, value] of Object.entries(shape)) {
    if (key.startsWith("_")) {
      // Make the private property optional
      privateShape[key] = value.optional();
    } else {
      privateShape[key] = value;
    }
  }

  // Return a new schema with only private properties (all optional)
  return z.object(privateShape);
}

/**
 * Parse `jumpTo` target from user facing labels to a LangGraph node names
 */
export function parseJumpToTarget(target: string): JumpTo;
export function parseJumpToTarget(target?: string): JumpTo | undefined {
  if (!target) {
    return undefined;
  }

  /**
   * if target is already a valid jump target, return it
   */
  if (["model_request", "tools", END].includes(target)) {
    return target as JumpTo;
  }

  if (target === "model") {
    return "model_request";
  }
  if (target === "tools") {
    return "tools";
  }
  if (target === "end") {
    return END;
  }

  throw new Error(
    `Invalid jump target: ${target}, must be "model", "tools" or "end".`
  );
}
