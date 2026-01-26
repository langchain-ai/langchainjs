/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod/v4";
import { type BaseMessage } from "@langchain/core/messages";
import {
  interopSafeParseAsync,
  interopZodObjectMakeFieldsOptional,
  interopZodObjectPartial,
  isInteropZodObject,
  isZodSchemaV4,
  type InteropZodObject,
} from "@langchain/core/utils/types";
import type { StateDefinitionInit } from "@langchain/langgraph";
import { END, StateSchema, ReducedValue } from "@langchain/langgraph";

import type { JumpTo } from "../types.js";
import type { AgentMiddleware } from "../middleware/types.js";

/**
 * Helper function to initialize middleware state defaults.
 * This is used to ensure all middleware state properties are initialized.
 *
 * Private properties (starting with _) are automatically made optional since
 * users cannot provide them when invoking the agent.
 */
export async function initializeMiddlewareStates(
  middlewareList: readonly AgentMiddleware[],
  state: unknown
): Promise<Record<string, any>> {
  const middlewareStates: Record<string, any> = {};

  for (const middleware of middlewareList) {
    /**
     * skip middleware if it doesn't have a state schema
     */
    if (!middleware.stateSchema) {
      continue;
    }

    // Convert StateSchema to Zod object if needed
    let zodSchema = middleware.stateSchema;
    if (StateSchema.isInstance(middleware.stateSchema)) {
      const zodShape: Record<string, any> = {};
      for (const [key, field] of Object.entries(
        middleware.stateSchema.fields
      )) {
        if (ReducedValue.isInstance(field)) {
          // For ReducedValue, use inputSchema if available, otherwise valueSchema
          zodShape[key] = field.inputSchema || field.valueSchema;
        } else {
          zodShape[key] = field;
        }
      }
      zodSchema = z.object(zodShape);
    }

    // Create a modified schema where private properties are optional
    const modifiedSchema = interopZodObjectMakeFieldsOptional(
      zodSchema,
      (key) => key.startsWith("_")
    );

    // Use safeParse with the modified schema
    const parseResult = await interopSafeParseAsync(modifiedSchema, state);
    if (parseResult.success) {
      Object.assign(middlewareStates, parseResult.data);
      continue;
    }

    /**
     * If safeParse fails, there are required public fields missing.
     * Note: Zod v3 uses message "Required", Zod v4 uses "Invalid input: expected X, received undefined"
     */
    const requiredFields = parseResult.error.issues
      .filter((issue) => issue.code === "invalid_type")
      .map((issue) => `  - ${issue.path.join(".")}: Required`)
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

  return middlewareStates;
}

/**
 * Users can define private and public state for a middleware. Private state properties start with an underscore.
 * This function will return the private state properties from the state schema, making all of them optional.
 * @param stateSchema - The middleware state schema
 * @returns A new schema containing only the private properties (underscore-prefixed), all made optional
 */
export function derivePrivateState(
  stateSchema?: z.ZodObject<z.ZodRawShape> | StateSchema<any>
): z.ZodObject<z.ZodRawShape> {
  const builtInStateSchema = {
    messages: z.custom<BaseMessage[]>(() => []),
    // Include optional structuredResponse so after_agent hooks can access/modify it
    structuredResponse: z.any().optional(),
  };

  if (!stateSchema) {
    return z.object(builtInStateSchema);
  }

  // Extract shape from either StateSchema or Zod object
  let shape: Record<string, any>;
  if (StateSchema.isInstance(stateSchema)) {
    // For StateSchema, extract Zod schemas from fields
    shape = {};
    for (const [key, field] of Object.entries(stateSchema.fields)) {
      if (ReducedValue.isInstance(field)) {
        // For ReducedValue, use inputSchema if available, otherwise valueSchema
        shape[key] = field.inputSchema || field.valueSchema;
      } else {
        shape[key] = field;
      }
    }
  } else {
    shape = stateSchema.shape;
  }

  const privateShape: Record<string, any> = { ...builtInStateSchema };

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
 * Converts any supported schema type (ZodObject, StateSchema, AnnotationRoot) to a partial Zod object.
 * This is useful for parsing state loosely where all fields are optional.
 *
 * @param schema - The schema to convert (InteropZodObject, StateSchema, or AnnotationRoot)
 * @returns A partial Zod object schema where all fields are optional
 */
export function toPartialZodObject(
  schema: StateDefinitionInit
): InteropZodObject {
  // Handle ZodObject directly
  if (isInteropZodObject(schema)) {
    return interopZodObjectPartial(schema);
  }

  // Handle StateSchema: convert fields to Zod shape, then make partial
  if (StateSchema.isInstance(schema)) {
    const partialShape: Record<string, any> = {};
    for (const [key, field] of Object.entries(schema.fields)) {
      let fieldSchema: unknown;
      if (ReducedValue.isInstance(field)) {
        // For ReducedValue, use inputSchema if available, otherwise valueSchema
        fieldSchema = field.inputSchema || field.valueSchema;
      } else {
        fieldSchema = field;
      }
      // Only call .optional() on Zod v4 schemas, otherwise use z.any()
      partialShape[key] = isZodSchemaV4(fieldSchema)
        ? (fieldSchema as any).optional()
        : z.any().optional();
    }
    return z.object(partialShape);
  }

  // Fallback: return empty object schema
  return z.object({});
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

/**
 * TypeScript currently doesn't support types for `AbortSignal.any`
 * @see https://github.com/microsoft/TypeScript/issues/60695
 */
declare const AbortSignal: {
  any(signals: AbortSignal[]): AbortSignal;
};

/**
 * `config` always contains a signal from LangGraphs Pregel class.
 * To ensure we acknowledge the abort signal from the user, we merge it
 * with the signal from the ToolNode.
 *
 * @param signals - The signals to merge.
 * @returns The merged signal.
 */
export function mergeAbortSignals(
  ...signals: (AbortSignal | undefined)[]
): AbortSignal {
  return AbortSignal.any(
    signals.filter(
      (maybeSignal): maybeSignal is AbortSignal =>
        maybeSignal !== null &&
        maybeSignal !== undefined &&
        typeof maybeSignal === "object" &&
        "aborted" in maybeSignal &&
        typeof maybeSignal.aborted === "boolean"
    )
  );
}
