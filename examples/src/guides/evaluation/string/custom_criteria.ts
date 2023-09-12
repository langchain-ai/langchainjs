import { loadEvaluator } from "langchain/evaluation";

const customCriterion = {
  numeric: "Does the output contain numeric or mathematical information?",
};

const evaluator = await loadEvaluator("criteria", {
  criteria: customCriterion,
});

const query = "Tell me a joke";
const prediction = "I ate some square pie but I don't know the square of pi.";

const res = await evaluator.evaluateStrings({
  input: query,
  prediction,
});

console.log(res);

/*
{
  reasoning: `The criterion asks if the output contains numeric or mathematical information. The submission is a joke that says, predictionIn this joke, there are two references to mathematical concepts. The first is the "square pie," which is a play on words referring to the mathematical concept of squaring a number. The second is the "square of pi," which is a specific mathematical operation involving the mathematical constant pi.Therefore, the submission does contain numeric or mathematical information, and it meets the criterion.Y`,
  value: 'Y',
  score: 1
}
 */

// If you wanted to specify multiple criteria. Generally not recommended

const customMultipleCriterion = {
  numeric: "Does the output contain numeric information?",
  mathematical: "Does the output contain mathematical information?",
  grammatical: "Is the output grammatically correct?",
  logical: "Is the output logical?",
};

const chain = await loadEvaluator("criteria", {
  criteria: customMultipleCriterion,
});

const res2 = await chain.evaluateStrings({
  input: query,
  prediction,
});

console.log(res2);

/*
{
  reasoning: `Let's assess the submission based on the given criteria:1. Numeric: The output does not contain any numeric information. There are no numbers present in the joke.2. Mathematical: The output does contain mathematical information. The joke refers to the mathematical concept of squaring a number, and also mentions pi, a mathematical constant.3. Grammatical: The output is grammatically correct. The sentence structure and word usage are appropriate.4. Logical: The output is logical. The joke makes sense in that it plays on the words "square pie" and "square of pi".Based on this analysis, the submission does not meet all the criteria because it does not contain numeric information.N`,
  value: 'N',
  score: 0
}
 */
