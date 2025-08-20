import { BaseMessage } from "@langchain/core/messages";
import {
  Annotation,
  Messages,
  messagesStateReducer,
} from "@langchain/langgraph";
import type { ResponseFormatUndefined } from "./types.js";

export const PreHookAnnotation = Annotation.Root({
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

// Base annotation without structuredResponse (for ResponseFormatUndefined)
export const createAgentBaseAnnotation = () =>
  Annotation.Root({
    messages: Annotation<BaseMessage[], Messages>({
      reducer: messagesStateReducer,
      default: () => [],
    }),
  });

// Full annotation with structuredResponse (for regular cases)
const createAgentAnnotation = <
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<string, any> = Record<string, any>
>() =>
  Annotation.Root({
    messages: Annotation<BaseMessage[], Messages>({
      reducer: messagesStateReducer,
      default: () => [],
    }),
    structuredResponse: Annotation<T>,
  });

// Create annotation conditionally - for ResponseFormatUndefined, don't include structuredResponse
export function createAgentAnnotationConditional<
  T extends Record<string, any> | ResponseFormatUndefined
>(hasStructuredResponse = true) {
  const baseAnnotation = {
    messages: Annotation<BaseMessage[], Messages>({
      reducer: messagesStateReducer,
      default: () => [],
    }),
  };

  if (!hasStructuredResponse) {
    return Annotation.Root(baseAnnotation);
  }

  return Annotation.Root({
    ...baseAnnotation,
    structuredResponse:
      Annotation<T extends ResponseFormatUndefined ? never : T>(),
  });
}

// Helper type to select the right annotation based on the response format type
export type ReactAgentAnnotation<
  T extends Record<string, any> | ResponseFormatUndefined
> = T extends ResponseFormatUndefined
  ? ReturnType<typeof createAgentBaseAnnotation>
  : T extends Record<string, any>
  ? ReturnType<typeof createAgentAnnotation<T>>
  : never;
