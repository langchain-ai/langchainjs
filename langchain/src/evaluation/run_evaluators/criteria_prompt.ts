import { PromptTemplate } from "../../prompts/prompt.js";

// H/T to https://github.com/openai/evals/tree/main
const CRITERIA_TEMPLATE = `You are assessing a submitted answer on a given task or input based on a set of criteria. Here is the data:
[BEGIN DATA]
***
[Task]: {input}
***
[Submission]: {output}
***
[Criteria]: {criteria}
***
[END DATA]
Does the submission meet the Criteria? First, write out in a step by step manner your reasoning about the criterion to be sure that your conclusion is correct. Avoid simply stating the correct answers at the outset. Then print only the single character "Y" or "N" (without quotes or punctuation) on its own line corresponding to the correct answer. At the end, repeat just the letter again by itself on a new line.`;

export const CRITERIA_PROMPT = /* #__PURE__ */ new PromptTemplate({
  inputVariables: ["input", "output", "criteria"],
  template: CRITERIA_TEMPLATE,
});
