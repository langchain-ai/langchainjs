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
});
export type PreHookAnnotation = typeof PreHookAnnotation;
