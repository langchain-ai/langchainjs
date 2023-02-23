/* eslint-disable */
import { PromptTemplate } from "../../prompts/index.js";

const template = `Write a concise summary of the following:


"{text}"


CONCISE SUMMARY:`;

export const DEFAULT_PROMPT = new PromptTemplate({
  template: template,
  inputVariables: ["text"],
});
