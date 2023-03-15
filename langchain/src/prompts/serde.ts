import type { SerializedOutputParser } from "../output_parsers";
import { Example } from "../schema";
import type { TemplateFormat } from "./template";

export type SerializedPromptTemplate = {
  _type?: "prompt";
  input_variables: string[];
  output_parser?: SerializedOutputParser;
  template_format?: TemplateFormat;
  template?: string;
  template_path?: string;
};

export type SerializedFewShotTemplate = {
  _type: "few_shot";
  input_variables: string[];
  output_parser?: SerializedOutputParser;
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

export type SerializedBaseMessagePromptTemplate = {
  _type: "message";
  input_variables: string[];
};

/** Serialized Chat prompt template */
export type SerializedChatPromptTemplate = {
  _type?: "chat_prompt";
  input_variables: string[];
  output_parser?: SerializedOutputParser;
  template_format?: TemplateFormat;
  prompt_messages: SerializedBaseMessagePromptTemplate[];
};

export type SerializedBasePromptTemplate =
  | SerializedFewShotTemplate
  | SerializedPromptTemplate
  | SerializedChatPromptTemplate;
