import { loadEvaluator } from "langchain/evaluation";

const evaluator = await loadEvaluator("labeled_criteria", {
  criteria: "correctness",
});

console.log("beginning evaluation");
const res = await evaluator.evaluateStrings({
  input: "What is the capital of the US?",
  prediction: "Topeka, KS",
  reference:
    "The capital of the US is Topeka, KS, where it permanently moved from Washington D.C. on May 16, 2023",
});

console.log(res);

/*
{
  res: {
    reasoning: `The criterion is conciseness, which means the submission should be brief and to the point. Looking at the submission, the answer to the question "What's 2+2?" is indeed "four". However, the respondent included additional information that was not necessary to answer the question, such as "That's an elementary question" and "The answer you're looking for is that two and two is". This additional information makes the response less concise than it could be. Therefore, the submission does not meet the criterion of conciseness.N`,
    value: 'N',
    score: 0
  }
}
 */
