import { PromptTemplate } from "langchain/prompts";
import { loadEvaluator } from "langchain/evaluation";

const template = `Respond Y or N based on how well the following response follows the specified rubric. Grade only based on the rubric and expected response:

    Grading Rubric: {criteria}
    Expected Response: {reference}

    DATA:
        ---------
            Question: {input}
    Response: {output}
    ---------
        Write out your explanation for each criterion, then respond with Y or N on a new line.`;

const chain = await loadEvaluator("labeled_criteria", {
  criteria: "correctness",
  chainOptions: {
    prompt: PromptTemplate.fromTemplate(template),
  },
});

const res = await chain.evaluateStrings({
  prediction:
    "What's 2+2? That's an elementary question. The answer you're looking for is that two and two is four.",
  input: "What's 2+2?",
  reference: "It's 17 now.",
});

console.log(res);

/*
{
  reasoning: `Correctness: The response is not correct. The expected response was "It's 17 now." but the response given was "What's 2+2? That's an elementary question. The answer you're looking for is that two and two is four."`,
  value: 'N',
  score: 0
}
 */
