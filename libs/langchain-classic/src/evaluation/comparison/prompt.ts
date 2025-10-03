/**
 * Prompts for comparing the outputs of two models for a given question.
 *
 * This prompt is used to compare two responses and evaluate which one best follows the instructions
 * and answers the question. The prompt is based on the paper from
 * Zheng, et. al. https://arxiv.org/abs/2306.05685
 */

import { PromptTemplate } from "@langchain/core/prompts";

const template = `Act as a fair judge and rate the two responses to the question below.\
 Choose the response that best followed the instructions and answered the question.\
 Your assessment should weigh the following criteria:
{criteria}\
 Start by comparing both responses and give a brief rationale.\
 Avoid bias from the order of presentation or response length.
After giving your rationale, make your final decision using this format:\
 "[[A]]" if assistant A is better, "[[B]]" if assistant B is better,\
 and "[[C]]" for a tie. Finally, repeat the decision again on its own on a new line.

[QUESTION]
{input}
[/QUESTION]

[RESPONSE A]
{prediction}
[/RESPONSE A]

[RESPONSE B]
{predictionB}
[/RESPONSE B]`;

export const PROMPT = /* #__PURE__ */ new PromptTemplate({
  inputVariables: ["input", "prediction", "predictionB", "criteria"],
  template,
});

const referenceTemplate = `Act as a fair judge and rate the two responses to the question below.\
 Choose the response that best followed the instructions and answered the question.\
 Your assessment should weigh the following criteria:
{criteria}\
 Start by comparing both responses and give a brief rationale.\
 Avoid bias from the order of presentation or response length.\
 Weigh accuracy based on the following ground truth reference\
 answer to the question:

[REFERENCE]
{reference}
[/REFERENCE]

After giving your rationale, make your final decision using this format:\
 "[[A]]" if assistant A is better, "[[B]]" if assistant B is better,\
 and "[[C]]" for a tie. Finally, repeat the decision again on its own on a new line.

[QUESTION]
{input}
[/QUESTION]

[RESPONSE A]
{prediction}
[/RESPONSE A]

[RESPONSE B]
{predictionB}
[/RESPONSE B]`;

export const PROMPT_WITH_REFERENCES = /* #__PURE__ */ new PromptTemplate({
  inputVariables: [
    "input",
    "prediction",
    "predictionB",
    "reference",
    "criteria",
  ],
  template: referenceTemplate,
});
