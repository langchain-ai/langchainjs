import { loadEvaluator } from "@langchain/classic/evaluation";
import { ChatOpenAI } from "@langchain/openai";

const chain = await loadEvaluator("pairwise_string", {
  llm: new ChatOpenAI({ model: "gpt-4o-mini" }),
  criteria: "conciseness",
});

const res = await chain.evaluateStringPairs({
  prediction: "Addition is a mathematical operation.",
  predictionB:
    "Addition is a mathematical operation that adds two numbers to create a third number, the 'sum'.",
  input: "What is addition?",
});

console.log({ res });

/*
  {
    res: {
      reasoning: 'Response A is concise, but it lacks detail. Response B, while slightly longer, provides a more complete and informative answer by explaining what addition does. It is still concise and to the point.Final decision: [[B]]',
      value: 'B',
      score: 0
    }
  }
*/
