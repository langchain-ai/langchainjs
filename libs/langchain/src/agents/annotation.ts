/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  StateSchema,
  MessagesValue,
  UntrackedValue,
  ReducedValue,
  type StateDefinitionInit,
} from "@langchain/langgraph";
import { schemaMetaRegistry } from "@langchain/langgraph/zod";

import type { AgentMiddleware } from "./middleware/types.js";
import {
  type InteropZodObject,
  isZodSchemaV4,
  getInteropZodObjectShape,
  isInteropZodObject,
} from "@langchain/core/utils/types";

/**
 * Type for jumpTo navigation targets
 */
type JumpToTarget = "model_request" | "tools" | "end" | undefined;

export function createAgentState<
  TStateSchema extends StateDefinitionInit | undefined = undefined,
  TMiddleware extends readonly AgentMiddleware<any, any, any>[] = [],
>(
  hasStructuredResponse = true,
  stateSchema: TStateSchema,
  middlewareList: TMiddleware = [] as unknown as TMiddleware
) {
  /**
   * Collect fields from state schemas
   */
  const stateFields: Record<string, any> = {
    // jumpTo is used for internal navigation control
    jumpTo: new UntrackedValue<JumpToTarget>(),
  };

  // Separate shapes for input/output without reducer metadata (to avoid channel conflicts)
  const inputFields: Record<string, any> = {};
  const outputFields: Record<string, any> = {};

  const applySchema = (schema: InteropZodObject | StateSchema<any>) => {
    // Handle StateSchema: extract from .fields
    if (StateSchema.isInstance(schema)) {
      for (const [key, field] of Object.entries(schema.fields)) {
        if (key.startsWith("_")) {
          continue;
        }
        if (!(key in stateFields)) {
          // Add to stateFields to preserve ReducedValue/UntrackedValue behavior
          stateFields[key] = field;

          // For ioFields, extract the appropriate schema from ReducedValue
          if (ReducedValue.isInstance(field)) {
            // For input, use inputSchema if available, otherwise use the value schema
            inputFields[key] = field.inputSchema || field.valueSchema;
            outputFields[key] = field.valueSchema;
          } else {
            // For non-ReducedValue fields, use the field as-is
            inputFields[key] = field;
            outputFields[key] = field;
          }
        }
      }
      return;
    }

    // Handle Zod v3/v4: extract shape using interop utilities
    const shape = getInteropZodObjectShape(schema);
    for (const [key, fieldSchema] of Object.entries(shape)) {
      // Skip private state properties (prefixed with underscore)
      if (key.startsWith("_")) {
        continue;
      }
      if (!(key in stateFields)) {
        // Check for reducer metadata (Zod v4 only supports schemaMetaRegistry)
        if (isZodSchemaV4(fieldSchema)) {
          const meta = schemaMetaRegistry.get(fieldSchema);
          if (meta?.reducer) {
            // Wrap with ReducedValue to preserve reducer behavior
            if (meta.reducer.schema) {
              stateFields[key] = new ReducedValue(fieldSchema as any, {
                inputSchema: meta.reducer.schema as any,
                reducer: meta.reducer.fn,
              });
              // For input, use the inputSchema
              inputFields[key] = meta.reducer.schema;
              outputFields[key] = fieldSchema;
            } else {
              stateFields[key] = new ReducedValue(fieldSchema as any, {
                reducer: meta.reducer.fn,
              });
              // No inputSchema, use the value schema
              inputFields[key] = fieldSchema;
              outputFields[key] = fieldSchema;
            }
            continue;
          }
        }

        // No reducer - use schema directly
        stateFields[key] = fieldSchema;
        inputFields[key] = fieldSchema;
        outputFields[key] = fieldSchema;
      }
    }
  };

  /**
   * Add state schema properties from user-provided schema.
   * Supports both StateSchema and Zod v3/v4 objects.
   */
  if (
    stateSchema &&
    (StateSchema.isInstance(stateSchema) || isInteropZodObject(stateSchema))
  ) {
    applySchema(stateSchema);
  }

  /**
   * Add state schema properties from middleware.
   * Supports both StateSchema and Zod v3/v4 objects.
   */
  for (const middleware of middlewareList) {
    if (
      middleware.stateSchema &&
      (StateSchema.isInstance(middleware.stateSchema) ||
        isInteropZodObject(middleware.stateSchema))
    ) {
      applySchema(middleware.stateSchema);
    }
  }

  // Only include structuredResponse when responseFormat is defined
  if (hasStructuredResponse) {
    outputFields.structuredResponse = new UntrackedValue<any>();
  }

  /**
   * Create StateSchema instances for state, input, and output.
   * Using MessagesValue provides the proper message reducer behavior.
   */
  return {
    state: new StateSchema({
      messages: MessagesValue,
      ...stateFields,
    }),
    input: new StateSchema({
      messages: MessagesValue,
      ...inputFields,
    }),
    output: new StateSchema({
      messages: MessagesValue,
      ...outputFields,
    }),
  };
}
