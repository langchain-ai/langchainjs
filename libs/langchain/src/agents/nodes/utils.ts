/* eslint-disable @typescript-eslint/no-explicit-any */
import { type BaseMessage } from "@langchain/core/messages";
import {
  getInteropZodObjectShape,
  interopSafeParseAsync,
  interopZodObjectMakeFieldsOptional,
} from "@langchain/core/utils/types";
import { END } from "@langchain/langgraph";
import { schemaMetaRegistry } from "@langchain/langgraph/zod";
import { z } from "zod/v3";

import type { AgentMiddleware } from "../middleware/types.js";
import type { JumpTo } from "../types.js";

/**
 * Helper function to initialize middleware state defaults.
 * This is used to ensure all middleware state properties are initialized.
 *
 * Private properties (starting with _) are automatically made optional since
 * users cannot provide them when invoking the agent.
 *
 * This function also checks the LangGraph schemaMetaRegistry for fields with
 * default values defined via withLangGraph(), and applies those defaults when
 * the fields are omitted from the input state.
 */
export async function initializeMiddlewareStates(
  middlewareList: readonly AgentMiddleware[],
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
       * If safeParse fails, check if the missing fields have defaults in the
       * schemaMetaRegistry (from withLangGraph). If they do, apply the defaults.
       * Only throw an error for truly required fields (no defaults, not optional).
       */
      const shape = getInteropZodObjectShape(middleware.stateSchema);
      const missingRequiredFields: string[] = [];
      const fieldsWithDefaults: Record<string, any> = {};

      for (const issue of parseResult.error.issues) {
        if (issue.code === "invalid_type" && issue.message === "Required") {
          const fieldName = issue.path[0] as string;
          const fieldSchema = shape[fieldName];

          if (fieldSchema) {
            // Check if this field has a default in the registry
            const meta = schemaMetaRegistry.get(fieldSchema);
            if (meta?.default) {
              // Apply the default value
              fieldsWithDefaults[fieldName] = meta.default();
            } else {
              // No default found - this is truly required
              missingRequiredFields.push(
                `  - ${issue.path.join(".")}: ${issue.message}`
              );
            }
          }
        }
      }

      // If there are truly required fields (no defaults), throw an error
      if (missingRequiredFields.length > 0) {
        throw new Error(
          `Middleware "${middleware.name}" has required state fields that must be initialized:\n` +
            `${missingRequiredFields.join("\n")}\n\n` +
            `To fix this, either:\n` +
            `1. Provide default values in your middleware's state schema using withLangGraph():\n` +
            `   import { withLangGraph } from "@langchain/langgraph/zod";\n` +
            `   stateSchema: z.object({\n` +
            `     myField: withLangGraph(z.string(), { default: () => "default value" })\n` +
            `   })\n\n` +
            `2. Or use Zod's .default():\n` +
            `   stateSchema: z.object({\n` +
            `     myField: z.string().default("default value")\n` +
            `   })\n\n` +
            `3. Or make the fields optional using .optional():\n` +
            `   stateSchema: z.object({\n` +
            `     myField: z.string().optional()\n` +
            `   })\n\n` +
            `4. Or ensure you pass these values when invoking the agent:\n` +
            `   agent.invoke({\n` +
            `     messages: [...],\n` +
            `     ${missingRequiredFields[0]
              ?.split(":")[0]
              ?.trim()
              .replace("- ", "")}: "value"\n` +
            `   })`
        );
      }

      // Merge the fields with applied defaults into middlewareStates
      Object.assign(middlewareStates, fieldsWithDefaults);
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
    // Include optional structuredResponse so after_agent hooks can access/modify it
    structuredResponse: z.any().optional(),
  };

  if (!stateSchema) {
    return z.object(builtInStateSchema);
  }

  const { shape } = stateSchema;
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
