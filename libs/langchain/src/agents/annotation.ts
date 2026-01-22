/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  StateSchema,
  MessagesValue,
  UntrackedValue,
  ReducedValue,
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

export function createAgentAnnotationConditional<
  TStateSchema extends
  StateDefinitionInit | undefined = undefined,
  TMiddleware extends readonly AgentMiddleware<any, any, any>[] = [],
>(
  hasStructuredResponse = true,
  stateSchema: TStateSchema,
  middlewareList: TMiddleware = [] as unknown as TMiddleware
) {
  const isStateSchema = (schema: unknown): schema is StateSchema<any> =>
    StateSchema.isInstance(schema);

  /**
   * Collect fields from state schemas
   */
  const stateFields: Record<string, any> = {
    // jumpTo is used for internal navigation control
    jumpTo: new UntrackedValue<JumpToTarget>(),
  };

  // Separate shape for input/output without reducer metadata (to avoid channel conflicts)
  const ioFields: Record<string, any> = {};

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
          // Also add to ioFields for input/output schema
          ioFields[key] = field;
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
              stateFields[key] = new ReducedValue(fieldSchema, {
                inputSchema: meta.reducer.schema,
                reducer: meta.reducer.fn,
              });
            } else {
              stateFields[key] = new ReducedValue(fieldSchema, {
                reducer: meta.reducer.fn,
              });
            }
            ioFields[key] = fieldSchema;
            continue;
          }
        }

        // No reducer - use schema directly
        stateFields[key] = fieldSchema;
        ioFields[key] = fieldSchema;
      }
    }
  };

  /**
   * Add state schema properties from user-provided schema.
   * Supports both StateSchema and Zod v3/v4 objects.
   */
  if (stateSchema) {
    if (isStateSchema(stateSchema)) {
      applySchema(stateSchema);
    } else if (isInteropZodObject(stateSchema)) {
      applySchema(stateSchema);
    }
  }

  /**
   * Add state schema properties from middleware.
   * Supports both StateSchema and Zod v3/v4 objects.
   */
  for (const middleware of middlewareList) {
    if (middleware.stateSchema) {
      if (isStateSchema(middleware.stateSchema)) {
        applySchema(middleware.stateSchema);
      } else if (isInteropZodObject(middleware.stateSchema)) {
        applySchema(middleware.stateSchema as InteropZodObject);
      }
    }
  }

  // Only include structuredResponse when responseFormat is defined
  if (hasStructuredResponse) {
    stateFields.structuredResponse = new UntrackedValue<string | undefined>();
    ioFields.structuredResponse = new UntrackedValue<string | undefined>();
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
      ...Object.fromEntries(
        Object.entries(ioFields).filter(
          ([key]) => !["structuredResponse", "jumpTo"].includes(key)
        )
      ),
    }),
    output: new StateSchema({
      messages: MessagesValue,
      ...Object.fromEntries(
        Object.entries(ioFields).filter(([key]) => key !== "jumpTo")
      ),
    }),
  };
}
