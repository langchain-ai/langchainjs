/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseMessage } from "@langchain/core/messages";
import {
  Annotation,
  Messages,
  AnnotationRoot,
  messagesStateReducer,
  type BinaryOperatorAggregate,
  type LastValue,
} from "@langchain/langgraph";
import type { InteropZodToStateDefinition } from "@langchain/langgraph/zod";
import type { InteropZodObject } from "@langchain/core/utils/types";

import type { AgentMiddleware, InferMiddlewareStates } from "./types.js";

/**
 * Special type to indicate that no response format is provided.
 * When this type is used, the structuredResponse property should not be present in the result.
 */
export type ResponseFormatUndefined = {
  __responseFormatUndefined: true;
};

export type AnyAnnotationRoot = AnnotationRoot<any>;

export type ToAnnotationRoot<A extends AnyAnnotationRoot | InteropZodObject> =
  A extends AnyAnnotationRoot
    ? A
    : A extends InteropZodObject
    ? AnnotationRoot<InteropZodToStateDefinition<A>>
    : never;

/**
 * Create annotation conditionally - for ResponseFormatUndefined, don't include structuredResponse
 * Helper type for the merged annotation
 */
type MergedAnnotationSpec<
  T extends Record<string, any> | ResponseFormatUndefined,
  TMiddleware extends readonly AgentMiddleware<any, any, any>[]
> = {
  messages: BinaryOperatorAggregate<BaseMessage[], Messages>;
  jumpTo: LastValue<"model_request" | "tools" | undefined>;
} & (T extends ResponseFormatUndefined
  ? {}
  : { structuredResponse: LastValue<T> }) &
  InferMiddlewareStates<TMiddleware>;

export function createAgentAnnotationConditional<
  T extends Record<string, any> | ResponseFormatUndefined,
  TMiddleware extends readonly AgentMiddleware<any, any, any>[] = []
>(
  hasStructuredResponse = true,
  middlewareList: TMiddleware = [] as unknown as TMiddleware
): AnnotationRoot<MergedAnnotationSpec<T, TMiddleware>> {
  const baseAnnotation: Record<string, any> = {
    messages: Annotation<BaseMessage[], Messages>({
      reducer: messagesStateReducer,
      default: () => [],
    }),
    jumpTo: Annotation<"model_request" | "tools" | undefined>({
      /**
       * Since `jumpTo` acts as a control command, we only want
       * to apply it if explicitly set.
       */
      reducer: (_x: any, y: any) => y,
      default: () => undefined,
    }),
  };

  // Add middleware state properties to the annotation
  for (const middleware of middlewareList) {
    if (middleware.stateSchema) {
      // Parse empty object to get default values
      let parsedDefaults: Record<string, any> = {};
      try {
        parsedDefaults = middleware.stateSchema.parse({});
      } catch {
        // If parsing fails, we'll use undefined as defaults
      }

      const { shape } = middleware.stateSchema;
      for (const [key] of Object.entries(shape)) {
        /**
         * Skip private state properties
         */
        if (key.startsWith("_")) {
          continue;
        }

        if (!(key in baseAnnotation)) {
          const defaultValue = parsedDefaults[key] ?? undefined;
          baseAnnotation[key] = Annotation({
            reducer: (x: any, y: any) => y ?? x,
            default: () => defaultValue,
          });
        }
      }
    }
  }

  if (!hasStructuredResponse) {
    return Annotation.Root(baseAnnotation) as AnnotationRoot<
      MergedAnnotationSpec<T, TMiddleware>
    >;
  }

  return Annotation.Root({
    ...baseAnnotation,
    structuredResponse:
      Annotation<T extends ResponseFormatUndefined ? never : T>(),
  }) as unknown as AnnotationRoot<MergedAnnotationSpec<T, TMiddleware>>;
}

export const PreHookAnnotation: AnnotationRoot<{
  llmInputMessages: BinaryOperatorAggregate<BaseMessage[], Messages>;
  messages: BinaryOperatorAggregate<BaseMessage[], Messages>;
}> = Annotation.Root({
  llmInputMessages: Annotation<BaseMessage[], Messages>({
    reducer: (_, update) => messagesStateReducer([], update),
    default: () => [],
  }),
  messages: Annotation<BaseMessage[], Messages>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
});
export type PreHookAnnotation = typeof PreHookAnnotation;
