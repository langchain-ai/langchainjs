import { test } from "vitest";
import { PromptTemplate } from "@langchain/core/prompts";
import { OpenAI } from "@langchain/openai";
import { ConstitutionalChain } from "../constitutional_ai/constitutional_chain.js";
import { ConstitutionalPrinciple } from "../constitutional_ai/constitutional_principle.js";
import { LLMChain } from "../llm_chain.js";

test("Test ConstitutionalChain", async () => {
  const llm = new OpenAI();
  const qaPrompt = new PromptTemplate({
    template: "Q: {question} A:",
    inputVariables: ["question"],
  });

  const qaChain = new LLMChain({
    llm,
    prompt: qaPrompt,
  });

  const constitutionalChain = ConstitutionalChain.fromLLM(llm, {
    chain: qaChain,
    constitutionalPrinciples: [
      new ConstitutionalPrinciple({
        critiqueRequest: "Tell me if this answer is good.",
        revisionRequest: "Give a better answer.",
      }),
    ],
  });

  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await constitutionalChain.invoke({
    question: "What is the meaning of life?",
  });
  // console.log({ res });
});
