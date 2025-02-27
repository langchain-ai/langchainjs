import type {
  ToolChoice,
  Tool as BedrockTool,
} from "@aws-sdk/client-bedrock-runtime";
import type { AwsCredentialIdentity, Provider } from "@aws-sdk/types";
import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { BindToolsInput } from "@langchain/core/language_models/chat_models";

export type CredentialType =
  | AwsCredentialIdentity
  | Provider<AwsCredentialIdentity>;

export type ConverseCommandParams = ConstructorParameters<
  typeof ConverseCommand
>[0];

export type BedrockToolChoice =
  | ToolChoice.AnyMember
  | ToolChoice.AutoMember
  | ToolChoice.ToolMember;
export type ChatBedrockConverseToolType = BindToolsInput | BedrockTool;

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
