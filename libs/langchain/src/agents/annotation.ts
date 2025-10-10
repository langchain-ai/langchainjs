/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseMessage } from "@langchain/core/messages";
import { z } from "zod/v3";
import {
  Messages,
  AnnotationRoot,
  MessagesZodMeta,
  type BinaryOperatorAggregate,
} from "@langchain/langgraph";
import { withLangGraph } from "@langchain/langgraph/zod";

import type { AgentMiddleware } from "./middleware/types.js";

export function createAgentAnnotationConditional<
  TMiddleware extends readonly AgentMiddleware<any, any, any>[] = []
>(
  hasStructuredResponse = true,
  middlewareList: TMiddleware = [] as unknown as TMiddleware
) {
  /**
   * Create Zod schema object to preserve jsonSchemaExtra
   * metadata for LangGraph Studio using v3-compatible withLangGraph
   */
  const zodSchema: Record<string, any> = {
    messages: withLangGraph(z.custom<BaseMessage[]>(), MessagesZodMeta),
    jumpTo: z
      .union([z.literal("model_request"), z.literal("tools"), z.undefined()])
      .optional(),
  };

  /**
   * Add middleware state properties to the Zod schema
   */
  for (const middleware of middlewareList) {
    if (middleware.stateSchema) {
      const { shape } = middleware.stateSchema;
      for (const [key, schema] of Object.entries(shape)) {
        /**
         * Skip private state properties
         */
        if (key.startsWith("_")) {
          continue;
        }

        if (!(key in zodSchema)) {
          zodSchema[key] = schema;
        }
      }
    }
  }

  if (!hasStructuredResponse) {
    return z.object(zodSchema);
  }

  return z.object({
    ...zodSchema,
    structuredResponse: z.any().optional(),
  });
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
