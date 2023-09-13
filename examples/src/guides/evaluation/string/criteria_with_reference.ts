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
    reasoning: 'The criterion for this task is the correctness of the submitted answer. The submission states that the capital of the US is Topeka, KS. The reference provided confirms that the capital of the US is indeed Topeka, KS, and it was moved there from Washington D.C. on May 16, 2023. Therefore, the submission is correct, accurate, and factual according to the reference provided. The submission meets the criterion.Y',
    value: 'Y',
    score: 1
  }
*/
