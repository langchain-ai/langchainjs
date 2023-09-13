import { loadEvaluator } from "langchain/evaluation";

const evaluator = await loadEvaluator("criteria", { criteria: "conciseness" });

const res = await evaluator.evaluateStrings({
  input: "What's 2+2?",
  prediction:
    "What's 2+2? That's an elementary question. The answer you're looking for is that two and two is four.",
});

console.log({ res });

/*
{
  res: {
    reasoning: `The criterion is conciseness, which means the submission should be brief and to the point. Looking at the submission, the answer to the question "What's 2+2?" is indeed "four". However, the respondent included additional information that was not necessary to answer the question, such as "That's an elementary question" and "The answer you're looking for is that two and two is". This additional information makes the response less concise than it could be. Therefore, the submission does not meet the criterion of conciseness.N`,
    value: 'N',
    score: '0'
  }
}
 */
