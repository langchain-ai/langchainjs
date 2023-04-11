/* eslint-disable tree-shaking/no-side-effects-in-initialization */
/* eslint-disable spaced-comment */
import { PromptTemplate } from "../../prompts/prompt.js";

const template = `Write a concise summary of the following:


"{text}"


CONCISE SUMMARY:`;

export const DEFAULT_PROMPT = /*#__PURE__*/ new PromptTemplate({
  template,
  inputVariables: ["text"],
});
