import { loadEvaluator } from "langchain/evaluation";
import { PromptTemplate } from "langchain/prompts";

const promptTemplate = PromptTemplate.fromTemplate(
  `Given the input context, which do you prefer: A or B?
Evaluate based on the following criteria:
{criteria}
Reason step by step and finally, respond with either [[A]] or [[B]] on its own line.

DATA
----
input: {input}
reference: {reference}
A: {prediction}
B: {predictionB}
---
Reasoning:
`
);

const chain = await loadEvaluator("labeled_pairwise_string", {
  chainOptions: {
    prompt: promptTemplate,
  },
});

const res = await chain.evaluateStringPairs({
  prediction: "The dog that ate the ice cream was named fido.",
  predictionB: "The dog's name is spot",
  input: "What is the name of the dog that ate the ice cream?",
  reference: "The dog's name is fido",
});

console.log(res);

/*
  {
    reasoning: 'Helpfulness: Both A and B are helpful as they provide a direct answer to the question.Relevance: Both A and B refer to the question, but only A matches the reference text.Correctness: Only A is correct as it matches the reference text.Depth: Both A and B are straightforward and do not demonstrate depth of thought.Based on these criteria, the preferred response is A. ',
    value: 'A',
    score: 1
  }
*/
