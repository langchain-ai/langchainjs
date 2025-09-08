/* eslint-disable @typescript-eslint/ban-types */
import { BaseMessage } from "@langchain/core/messages";
import {
  Annotation,
  Messages,
  AnnotationRoot,
  messagesStateReducer,
  type BinaryOperatorAggregate,
  type LastValue,
} from "@langchain/langgraph";
import type { ResponseFormatUndefined } from "../responses.js";
import type { AgentMiddleware, InferMiddlewareStates } from "./types.js";

// Create annotation conditionally - for ResponseFormatUndefined, don't include structuredResponse
// Helper type for the merged annotation
type MergedAnnotationSpec<
  T extends Record<string, any> | ResponseFormatUndefined,
  TMiddlewares extends readonly AgentMiddleware<any, any, any>[]
> = {
  messages: BinaryOperatorAggregate<BaseMessage[], Messages>;
} & (T extends ResponseFormatUndefined
  ? {}
  : { structuredResponse: LastValue<T> }) &
  InferMiddlewareStates<TMiddlewares>;

export function createAgentAnnotationConditional<
  T extends Record<string, any> | ResponseFormatUndefined,
  TMiddlewares extends readonly AgentMiddleware<any, any, any>[] = []
>(
  hasStructuredResponse = true,
  middlewares: TMiddlewares = [] as unknown as TMiddlewares
): AnnotationRoot<MergedAnnotationSpec<T, TMiddlewares>> {
  const baseAnnotation: Record<string, any> = {
    messages: Annotation<BaseMessage[], Messages>({
      reducer: messagesStateReducer,
      default: () => [],
    }),
  };

  // Add middleware state properties to the annotation
  for (const middleware of middlewares) {
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
      MergedAnnotationSpec<T, TMiddlewares>
    >;
  }

  return Annotation.Root({
    ...baseAnnotation,
    structuredResponse:
      Annotation<T extends ResponseFormatUndefined ? never : T>(),
  }) as unknown as AnnotationRoot<MergedAnnotationSpec<T, TMiddlewares>>;
}
