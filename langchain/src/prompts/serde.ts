import type { Example } from "../schema/index.js";
import type { TemplateFormat } from "./template.js";

export type SerializedPromptTemplate = {
  _type?: "prompt";
  input_variables: string[];
  template_format?: TemplateFormat;
  template?: string;
};

export type SerializedFewShotTemplate = {
  _type: "few_shot";
  input_variables: string[];
  examples: string | Example[];
  example_prompt?: SerializedPromptTemplate;
  example_separator: string;
  prefix?: string;
  suffix?: string;
  template_format: TemplateFormat;
};

export type SerializedBasePromptTemplate =
  | SerializedFewShotTemplate
  | SerializedPromptTemplate;
