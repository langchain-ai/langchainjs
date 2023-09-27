import { loadEvaluator } from "langchain/evaluation";
import { ChatAnthropic } from "langchain/chat_models/anthropic";

const model = new ChatAnthropic({ temperature: 0 });

const chain = await loadEvaluator("labeled_pairwise_string", { llm: model });

const res = await chain.evaluateStringPairs({
  prediction: "there are three dogs",
  predictionB: "4",
  input: "how many dogs are in the park?",
  reference: "four",
});

console.log(res);

/*
  {
    reasoning: 'Here is my assessment:Response B is more correct and accurate compared to Response A. Response B simply states "4", which matches the ground truth reference answer of "four". Meanwhile, Response A states "there are three dogs", which is incorrect according to the reference. In terms of following instructions and directly answering the question "how many dogs are in the park?", Response B gives the precise numerical answer, while Response A provides an incomplete sentence. Overall, Response B is more accurate and better followed the instructions to directly answer the question.[[B]]',
    value: 'B',
    score: 0
  }
*/
