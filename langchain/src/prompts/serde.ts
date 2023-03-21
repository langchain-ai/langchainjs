import type { Example } from "../schema/index.js";
import type { TemplateFormat } from "./template.js";

export type SerializedPromptTemplate = {
  _type?: "prompt";
  input_variables: string[];
  template_format?: TemplateFormat;
  template?: string;
  template_path?: string;
};

export type SerializedFewShotTemplate = {
  _type: "few_shot";
  input_variables: string[];
  examples: string | Example[];
  example_prompt?: SerializedPromptTemplate;
  example_prompt_path?: string;
  example_separator: string;
  prefix?: string;
  prefix_path?: string;
  suffix?: string;
  suffix_path?: string;
  template_format: TemplateFormat;
};

export type SerializedMessagePromptTemplate = {
  _type: "message";
  input_variables: string[];
  [key: string]: unknown;
};

/** Serialized Chat prompt template */
export type SerializedChatPromptTemplate = {
  _type?: "chat_prompt";
  input_variables: string[];
  template_format?: TemplateFormat;
  prompt_messages: SerializedMessagePromptTemplate[];
};

export type SerializedBasePromptTemplate =
  | SerializedFewShotTemplate
  | SerializedPromptTemplate
  | SerializedChatPromptTemplate;
