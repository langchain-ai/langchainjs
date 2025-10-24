import { loadEvaluator } from "langchain/evaluation";

const chain = await loadEvaluator("labeled_pairwise_string", {
  criteria: "correctness",
});

const res = await chain.evaluateStringPairs({
  prediction: "there are three dogs",
  predictionB: "4",
  input: "how many dogs are in the park?",
  reference: "four",
});

console.log(res);

/*
  {
    reasoning: 'Both responses attempt to answer the question about the number of dogs in the park. However, Response A states that there are three dogs, which is incorrect according to the reference answer. Response B, on the other hand, correctly states that there are four dogs, which matches the reference answer. Therefore, Response B is more accurate.Final Decision: [[B]]',
    value: 'B',
    score: 0
  }
*/
