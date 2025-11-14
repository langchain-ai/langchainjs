/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseMessage } from "@langchain/core/messages";
import { z } from "zod/v3";
import {
  Messages,
  AnnotationRoot,
  MessagesZodMeta,
  type BinaryOperatorAggregate,
} from "@langchain/langgraph";
import { withLangGraph, schemaMetaRegistry } from "@langchain/langgraph/zod";

import type { AgentMiddleware, AnyAnnotationRoot } from "./middleware/types.js";
import { InteropZodObject } from "@langchain/core/utils/types";

export function createAgentAnnotationConditional<
  TStateSchema extends
    | AnyAnnotationRoot
    | InteropZodObject
    | undefined = undefined,
  TMiddleware extends readonly AgentMiddleware<any, any, any>[] = []
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
    messages: withLangGraph(z.custom<BaseMessage[]>(), MessagesZodMeta),
    jumpTo: z
      .union([
        z.literal("model_request"),
        z.literal("tools"),
        z.literal("end"),
        z.undefined(),
      ])
      .optional(),
  };

  const applySchema = (schema: { shape: Record<string, any> }) => {
    const { shape } = schema;
    for (const [key, schema] of Object.entries(shape)) {
      /**
       * Skip private state properties
       */
      if (key.startsWith("_")) {
        continue;
      }

      if (!(key in schemaShape)) {
        schemaShape[key] = schema;
      }
    }
  };

  // Add state schema properties to the Zod schema
  if (stateSchema && "shape" in stateSchema) {
    applySchema(stateSchema);
  }

  for (const middleware of middlewareList) {
    if (middleware.stateSchema) {
      applySchema(middleware.stateSchema);
    }
  }

  // Only include structuredResponse when responseFormat is defined
  if (hasStructuredResponse) {
    schemaShape.structuredResponse = z.any().optional();
  }

  const zodSchema = z.object(schemaShape);
  const stateDefinition = schemaMetaRegistry.getChannelsForSchema(zodSchema);
  return stateDefinition;
}

export const PreHookAnnotation: AnnotationRoot<{
  llmInputMessages: BinaryOperatorAggregate<BaseMessage[], Messages>;
  messages: BinaryOperatorAggregate<BaseMessage[], Messages>;
}> = z.object({
  llmInputMessages: withLangGraph(z.custom<BaseMessage[]>(), {
    reducer: {
      fn: (_x: Messages, update: Messages) =>
        MessagesZodMeta.reducer!.fn([], update),
    },
    default: () => [],
  }),
  /**
   * Use MessagesZodMeta to preserve jsonSchemaExtra metadata
   * for LangGraph Studio UI to render proper messages input field
   */
  messages: withLangGraph(z.custom<BaseMessage[]>(), MessagesZodMeta),
}) as unknown as AnnotationRoot<{
  llmInputMessages: BinaryOperatorAggregate<BaseMessage[], Messages>;
  messages: BinaryOperatorAggregate<BaseMessage[], Messages>;
}>;

export type PreHookAnnotation = typeof PreHookAnnotation;
