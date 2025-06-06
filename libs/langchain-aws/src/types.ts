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

/**
 * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids.html
 */
export type BedrockChatModelId =
  | 'amazon.titan-tg1-large'
  | 'amazon.titan-text-express-v1'
  | 'anthropic.claude-v2'
  | 'anthropic.claude-v2:1'
  | 'anthropic.claude-instant-v1'
  | 'anthropic.claude-sonnet-4-20250514-v1:0'
  | 'anthropic.claude-opus-4-20250514-v1:0'
  | 'anthropic.claude-3-7-sonnet-20250219-v1:0'
  | 'anthropic.claude-3-5-sonnet-20240620-v1:0'
  | 'anthropic.claude-3-5-sonnet-20241022-v2:0'
  | 'anthropic.claude-3-5-haiku-20241022-v1:0'
  | 'anthropic.claude-3-sonnet-20240229-v1:0'
  | 'anthropic.claude-3-haiku-20240307-v1:0'
  | 'anthropic.claude-3-opus-20240229-v1:0'
  | 'cohere.command-text-v14'
  | 'cohere.command-light-text-v14'
  | 'cohere.command-r-v1:0'
  | 'cohere.command-r-plus-v1:0'
  | 'meta.llama3-70b-instruct-v1:0'
  | 'meta.llama3-8b-instruct-v1:0'
  | 'meta.llama3-1-405b-instruct-v1:0'
  | 'meta.llama3-1-70b-instruct-v1:0'
  | 'meta.llama3-1-8b-instruct-v1:0'
  | 'meta.llama3-2-11b-instruct-v1:0'
  | 'meta.llama3-2-1b-instruct-v1:0'
  | 'meta.llama3-2-3b-instruct-v1:0'
  | 'meta.llama3-2-90b-instruct-v1:0'
  | 'mistral.mistral-7b-instruct-v0:2'
  | 'mistral.mixtral-8x7b-instruct-v0:1'
  | 'mistral.mistral-large-2402-v1:0'
  | 'mistral.mistral-small-2402-v1:0'
  | 'amazon.titan-text-express-v1'
  | 'amazon.titan-text-lite-v1'
  | (string & NonNullable<unknown>);

/**
 * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids.html
 */
export type BedrockEmbeddingModelId =
  | 'amazon.titan-embed-text-v1'
  | 'amazon.titan-embed-text-v2:0'
  | 'cohere.embed-english-v3'
  | 'cohere.embed-multilingual-v3'
  | (string & NonNullable<unknown>);