import { test } from "@jest/globals";
import { ChatOpenAI } from "../../../chat_models/openai.js";
import {
  LabeledPairwiseStringEvalChain,
  PairwiseStringEvalChain,
} from "../pairwise.js";

test.skip("Test TrajectoryEvalChain", async () => {
  const model = new ChatOpenAI(
    {
      modelName: "gpt-4",
      verbose: true,
    },
    { baseURL: process.env.BASE_URL }
  );

  const chain = await PairwiseStringEvalChain.fromLLM(model, "conciseness");

  console.log("beginning evaluation");
  const res = await chain.evaluateStringPairs({
    prediction: "Addition is a mathematical operation.",
    predictionB:
      "Addition is a mathematical operation that adds two numbers to create a third number, the 'sum'.",
    input: "What is addition?",
  });

  console.log({ res });
});

test.skip("Test LabeledPairwiseStringEvalChain", async () => {
  const model = new ChatOpenAI(
    {
      modelName: "gpt-4",
      verbose: true,
    },
    { baseURL: process.env.BASE_URL }
  );

  const chain = await LabeledPairwiseStringEvalChain.fromLLM(
    model,
    "correctness"
  );

  console.log("beginning evaluation");
  const res = await chain.evaluateStringPairs({
    prediction: "there are three dogs",
    predictionB: "4",
    input: "how many dogs are in the park?",
    reference: "four",
  });

  console.log(res);
});

test("Test Custom  Criteria", async () => {
  const model = new ChatOpenAI(
    {
      modelName: "gpt-4",
      verbose: true,
    },
    { baseURL: process.env.BASE_URL }
  );

  const customCriterion = {
    simplicity: "Is the language straightforward and unpretentious?",
    clarity: "Are the sentences clear and easy to understand?",
    precision: "Is the writing precise, with no unnecessary words or details?",
    truthfulness: "Does the writing feel honest and sincere?",
    subtext: "Does the writing suggest deeper meanings or themes?",
  };

  const chain = await PairwiseStringEvalChain.fromLLM(model, customCriterion);

  console.log("beginning evaluation");
  const res = await chain.evaluateStringPairs({
    prediction:
      "Every cheerful household shares a similar rhythm of joy; but sorrow, in each household, plays a unique, haunting melody.",
    predictionB:
      "Where one finds a symphony of joy, every domicile of happiness resounds in harmonious, identical notes; yet, every abode of despair conducts a dissonant orchestra, each playing an elegy of grief that is peculiar and profound to its own existence.",
    input: "Write some prose about families.",
  });

  console.log(res);
});
