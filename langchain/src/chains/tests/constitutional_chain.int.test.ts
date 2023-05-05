import { test } from "@jest/globals";
import { ConstitutionalChain } from "../constitutional_ai/constitutional_chain.js";
import { ConstitutionalPrinciple } from "../constitutional_ai/constitutional_principle.js";
import { LLMChain } from "../llm_chain.js";
import { PromptTemplate } from "../../prompts/index.js";
import { OpenAI } from "../../llms/openai.js";

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

  const res = await constitutionalChain.call({
    question: "What is the meaning of life?",
  });
  console.log({ res });
});
