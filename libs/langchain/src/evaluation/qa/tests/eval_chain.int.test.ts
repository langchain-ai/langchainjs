import { test } from "@jest/globals";
import { OpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { QAEvalChain } from "../eval_chain.js";

test("Test QAEvalChain", async () => {
  const model = new OpenAI({ model: "gpt-3.5-turbo-instruct" });
  const prompt = new PromptTemplate({
    template: "{query} {answer} {result}",
    inputVariables: ["query", "answer", "result"],
  });
  const chain = QAEvalChain.fromLlm(model, { prompt });

  const examples = [
    { query: "What is your name?", answer: "ChatGPT" },
    { query: "What is your model?", answer: "GPT-4" },
  ];
  const predictions = [{ result: "ChatGPT" }, { result: "GPT-4" }];

  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chain.evaluate(examples, predictions);
  // console.log({ res });
});

test("Test QAEvalChain with incorrect input variables", async () => {
  const model = new OpenAI({ model: "gpt-3.5-turbo-instruct" });
  const prompt = new PromptTemplate({
    template: "{foo} {bar} {baz}",
    inputVariables: ["foo", "bar", "baz"],
  });

  expect(() => QAEvalChain.fromLlm(model, { prompt })).toThrowError(
    "Input variables should be query,answer,result, but got foo,bar,baz"
  );
});
