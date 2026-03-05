import {
  CodeExecutionTool,
  FunctionDeclarationsTool as GoogleGenerativeAIFunctionDeclarationsTool,
  GoogleSearchRetrievalTool,
  Part,
} from "@google/generative-ai";
import { BindToolsInput } from "@langchain/core/language_models/chat_models";

export type GoogleGenerativeAIToolType =
  | BindToolsInput
  | GoogleGenerativeAIFunctionDeclarationsTool
  | CodeExecutionTool
  | GoogleSearchRetrievalTool;

export type GoogleGenerativeAIThinkingConfig = {
  /** Indicates whether to include thoughts in the response. If true, thoughts are returned only when available. */
  includeThoughts?: boolean;
  /** The number of thoughts tokens that the model should generate. */
  thinkingBudget?: number;
  /** Optional. The level of thoughts tokens that the model should generate. */
  thinkingLevel?: GoogleGenerativeAIThinkingLevel;
};

export type GoogleGenerativeAIThinkingLevel =
  | "THINKING_LEVEL_UNSPECIFIED"
  | "LOW"
  | "MEDIUM"
  | "HIGH";

export type GoogleGenerativeAIPart = Part & {
  thought?: boolean;
  thoughtSignature?: string;
};
