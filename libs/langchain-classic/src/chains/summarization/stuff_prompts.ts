import { PromptTemplate } from "@langchain/core/prompts";

const template = `Write a concise summary of the following:


"{text}"


CONCISE SUMMARY:`;

export const DEFAULT_PROMPT = /*#__PURE__*/ new PromptTemplate({
  template,
  inputVariables: ["text"],
});
