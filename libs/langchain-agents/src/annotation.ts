import { BaseMessage } from "@langchain/core/messages";
import {
  Annotation,
  Messages,
  messagesStateReducer,
} from "@langchain/langgraph";

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

export const createReactAgentAnnotation = <
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
