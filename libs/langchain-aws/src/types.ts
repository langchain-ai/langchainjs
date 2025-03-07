import type {
  ToolChoice,
  Tool as BedrockTool,
  StopReason,
} from "@aws-sdk/client-bedrock-runtime";
import type { AwsCredentialIdentity, Provider } from "@aws-sdk/types";
import {
  ConverseCommand,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { BindToolsInput } from "@langchain/core/language_models/chat_models";

export type CredentialType =
  | AwsCredentialIdentity
  | Provider<AwsCredentialIdentity>;

export type ConverseCommandParams = ConstructorParameters<
  typeof ConverseCommand
>[0];

export type InvokeModelCommandParams = ConstructorParameters<
  typeof InvokeModelCommand
>[0];

export type InvokeModelBodyResponse = {
  id: string;
  type: string;
  role: string;
  model: string;
  content: Record<string, any>[];
  stop_reason: StopReason;
  stop_sequence: string[] | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
};
export type BedrockInvokeModelTool = {
  name: string | undefined;
  description?: string | undefined;
  input_schema: Record<string, any>;
};

export type BedrockToolChoice =
  | ToolChoice.AnyMember
  | ToolChoice.AutoMember
  | ToolChoice.ToolMember;
export type ChatBedrockConverseToolType = BindToolsInput | BedrockTool;
export type ChatBedrockInvokeModelToolType =
  | BindToolsInput
  | BedrockInvokeModelTool;

export type MessageContentReasoningBlockReasoningText = {
  type: "reasoning_content";
  reasoningText: {
    text: string;
    signature: string;
  };
};

export type MessageContentReasoningBlockRedacted = {
  type: "reasoning_content";
  redactedContent: string;
};

export type MessageContentReasoningBlockReasoningTextPartial = {
  type: "reasoning_content";
  reasoningText: { text: string } | { signature: string };
};

export type MessageContentReasoningBlock =
  | MessageContentReasoningBlockReasoningText
  | MessageContentReasoningBlockRedacted
  | MessageContentReasoningBlockReasoningTextPartial;
