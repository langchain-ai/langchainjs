import type { OpenAI as OpenAIClient } from "openai";
import type { AgentFinish, AgentAction } from "../../schema/index.js";

export type OpenAIAssistantFinish = AgentFinish & {
  runId: string;

  threadId: string;
};

export type OpenAIAssistantAction = AgentAction & {
  toolCallId: string;

  runId: string;

  threadId: string;
};

export type OpenAIToolType = Array<
  | OpenAIClient.Beta.AssistantCreateParams.AssistantToolsCode
  | OpenAIClient.Beta.AssistantCreateParams.AssistantToolsRetrieval
  | OpenAIClient.Beta.AssistantCreateParams.AssistantToolsFunction
>;
