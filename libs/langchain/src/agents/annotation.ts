/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod/v3";
import { MessagesZodState } from "@langchain/langgraph";
import { withLangGraph, schemaMetaRegistry } from "@langchain/langgraph/zod";

import type { AgentMiddleware, AnyAnnotationRoot } from "./middleware/types.js";
import {
  InteropZodObject,
  isZodSchemaV4,
  getInteropZodObjectShape,
} from "@langchain/core/utils/types";
import type { BaseMessage } from "@langchain/core/messages";

export function createAgentAnnotationConditional<
  TStateSchema extends
    | AnyAnnotationRoot
    | InteropZodObject
    | undefined = undefined,
  TMiddleware extends readonly AgentMiddleware<any, any, any>[] = [],
>(
  hasStructuredResponse = true,
  stateSchema: TStateSchema,
  middlewareList: TMiddleware = [] as unknown as TMiddleware
) {
  /**
   * Create Zod schema object to preserve jsonSchemaExtra
   * metadata for LangGraph Studio using v3-compatible withLangGraph
   */
  const schemaShape: Record<string, any> = {
    jumpTo: z
      .union([
        z.literal("model_request"),
        z.literal("tools"),
        z.literal("end"),
        z.undefined(),
      ])
      .optional(),
  };
  // Separate shape for input/output without reducer metadata (to avoid channel conflicts)
  const ioSchemaShape: Record<string, any> = {};

  const applySchema = (schema: InteropZodObject) => {
    // Handle both Zod v3 and v4 schemas
    const shape = isZodSchemaV4(schema)
      ? getInteropZodObjectShape(schema)
      : schema.shape;

    for (const [key, fieldSchema] of Object.entries(shape)) {
      /**
       * Skip private state properties
       */
      if (key.startsWith("_")) {
        continue;
      }

      if (!(key in schemaShape)) {
        /**
         * If the field schema is Zod v4, convert to v3-compatible z.any()
         * This allows the shape to be merged while preserving the key structure
         * Also transfer any registry metadata (reducers, defaults) to the new schema
         * using withLangGraph which properly registers the metadata
         */
        if (isZodSchemaV4(fieldSchema)) {
          const meta = schemaMetaRegistry.get(fieldSchema);
          if (meta) {
            // For state: include reducer metadata
            schemaShape[key] = withLangGraph(z.any(), meta);
            // For input/output: plain z.any() without reducer (avoids channel conflicts)
            ioSchemaShape[key] = z.any();
          } else {
            schemaShape[key] = z.any();
            ioSchemaShape[key] = z.any();
          }
        } else {
          schemaShape[key] = fieldSchema;
          ioSchemaShape[key] = fieldSchema;
        }
      }
    }
  };

  /**
   * Add state schema properties to the Zod schema
   */
  if (stateSchema && ("shape" in stateSchema || isZodSchemaV4(stateSchema))) {
    applySchema(stateSchema as InteropZodObject);
  }

  for (const middleware of middlewareList) {
    if (middleware.stateSchema) {
      applySchema(middleware.stateSchema as InteropZodObject);
    }
  }

  // Only include structuredResponse when responseFormat is defined
  if (hasStructuredResponse) {
    schemaShape.structuredResponse = z.string().optional();
    ioSchemaShape.structuredResponse = z.string().optional();
  }

  // Create messages field with LangGraph UI metadata for input/output schemas
  // Only use jsonSchemaExtra (no reducer) to avoid channel conflict - this creates
  // a LastValue channel which is allowed to coexist with the state's messages channel
  const messages = withLangGraph(z.custom<BaseMessage[]>(), {
    jsonSchemaExtra: { langgraph_type: "messages" },
  });

  return {
    state: MessagesZodState.extend(schemaShape),
    input: z.object({
      messages,
      ...Object.fromEntries(
        Object.entries(ioSchemaShape).filter(
          ([key]) => !["structuredResponse", "jumpTo"].includes(key)
        )
      ),
    }),
    output: z.object({
      messages,
      ...Object.fromEntries(
        Object.entries(ioSchemaShape).filter(([key]) => key !== "jumpTo")
      ),
    }),
  };
}
