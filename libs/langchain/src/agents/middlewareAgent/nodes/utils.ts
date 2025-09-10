/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  type BaseMessage,
  type ToolMessage,
  type AIMessage,
  isToolMessage,
  isAIMessage,
} from "@langchain/core/messages";
import { z, type ZodIssue, type ZodTypeAny } from "zod/v3";

import type { AgentMiddleware, ToolCall, ToolResult } from "../types.js";

/**
 * Helper function to initialize middleware state defaults.
 * This is used to ensure all middleware state properties are initialized.
 *
 * Private properties (starting with _) are automatically made optional since
 * users cannot provide them when invoking the agent.
 */
export function initializeMiddlewareStates(
  middlewareList: readonly AgentMiddleware<any, any, any>[],
  state: unknown
): Record<string, any> {
  const middlewareStates: Record<string, any> = {};

  for (const middleware of middlewareList) {
    if (middleware.stateSchema) {
      // Create a modified schema where private properties are optional
      const { shape } = middleware.stateSchema;
      const modifiedShape: Record<string, any> = {};

      for (const [key, value] of Object.entries(shape)) {
        if (key.startsWith("_")) {
          // Make private properties optional
          modifiedShape[key] = (value as ZodTypeAny).optional();
        } else {
          // Keep public properties as-is
          modifiedShape[key] = value;
        }
      }

      const modifiedSchema = z.object(modifiedShape);

      // Use safeParse with the modified schema
      const parseResult = modifiedSchema.safeParse(state);

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
 * Parse out all tool calls from the messages
 * @param messages - The messages to parse
 * @returns The tool calls
 */
export function parseToolCalls(messages: BaseMessage[]): ToolCall[] {
  return (
    messages
      .filter(
        (message) => isAIMessage(message) && (message as AIMessage).tool_calls
      )
      .map((message) => (message as AIMessage).tool_calls as ToolCall[])
      .flat() || []
  );
}

/**
 * Parse out all tool results from the messages
 * @param messages - The messages to parse
 * @returns The tool results
 */
export function parseToolResults(messages: BaseMessage[]): ToolResult[] {
  return messages
    .filter((message) => isToolMessage(message))
    .map((message) => ({
      id: (message as ToolMessage).tool_call_id,
      result: (message as ToolMessage).content,
    }));
}
