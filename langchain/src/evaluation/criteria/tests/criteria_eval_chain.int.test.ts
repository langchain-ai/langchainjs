import { expect, test } from "@jest/globals";
import { PRINCIPLES } from "../../../chains/index.js";
import { ChatAnthropic } from "../../../chat_models/anthropic.js";
import { PromptTemplate } from "../../../prompts/index.js";
import { loadEvaluator } from "../../loader.js";

test("Test CriteriaEvalChain", async () => {
  const evaluator = await loadEvaluator("criteria", {
    criteria: "conciseness",
  });

  const res = await evaluator.evaluateStrings({
    input: "What's 2+2?",
    prediction:
      "What's 2+2? That's an elementary question. The answer you're looking for is that two and two is four.",
  });

  expect(res.score).toBe(0);
  console.log({ res });
});

test("Test LabeledCriteriaEvalChain with reference", async () => {
  const evaluator = await loadEvaluator("labeled_criteria", {
    criteria: "correctness",
  });

  const res = await evaluator.evaluateStrings({
    input: "What is the capital of the US?",
    prediction: "Topeka, KS",
    reference:
      "The capital of the US is Topeka, KS, where it permanently moved from Washington D.C. on May 16, 2023",
  });

  expect(res.score).toBe(1);
  console.log(res);
});

test("Test Custom Criteria", async () => {
  const customCriterion = {
    numeric: "Does the output contain numeric or mathematical information?",
  };

  const evaluator = await loadEvaluator("criteria", {
    criteria: customCriterion,
  });

  const res = await evaluator.evaluateStrings({
    input: "Tell me a joke",
    prediction: "I ate some square pie but I don't know the square of pi.",
  });

  expect(res.score).toBe(1);
  console.log(res);
});

test("Test Custom Multiple Criteria", async () => {
  const customCriterion = {
    numeric: "Does the output contain numeric information?",
    mathematical: "Does the output contain mathematical information?",
    grammatical: "Is the output grammatically correct?",
    logical: "Is the output logical?",
  };

  const chain = await loadEvaluator("criteria", { criteria: customCriterion });

  const res = await chain.evaluateStrings({
    input: "Tell me a joke",
    prediction: "I ate some square pie but I don't know the square of pi.",
  });

  expect(res.score).toBe(0);
  console.log(res);
});

test("Test Using Constitutional Principles ", async () => {
  const chain = await loadEvaluator("criteria", {
    criteria: PRINCIPLES.harmful1,
  });

  console.log("beginning evaluation");
  const res = await chain.evaluateStrings({
    input: "What do you think of Will?",
    prediction:
      "I say that man is a lilly-livered nincompoop. I'm going to hurt him!",
  });
  expect(res.score).toBe(1);
  console.log(res);
});

test("Test Configuring the LLM", async () => {
  const model = new ChatAnthropic();

  const chain = await loadEvaluator("criteria", {
    criteria: PRINCIPLES.harmful1,
    llm: model,
  });

  const res = await chain.evaluateStrings({
    input: "What's 2+2?",
    prediction:
      "What's 2+2? That's an elementary question. The answer you're looking for is that two and two is four.",
  });

  expect(res.score).toBe(0);
  console.log(res);
});

test("Test Configuring the Prompt", async () => {
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

  expect(res.score).toBe(0);
  console.log(res);
});
