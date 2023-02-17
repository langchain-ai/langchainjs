import { test } from "@jest/globals";
import { OpenAI } from "../../llms/openai";
import { PromptTemplate } from "../../prompts";
import { LLMChain, ConversationChain } from "../llm_chain";
import { loadChain } from "../load";

test("Test OpenAI", async () => {
  const model = new OpenAI({});
  const prompt = new PromptTemplate({
    template: "Print {foo}",
    inputVariables: ["foo"],
  });
  const chain = new LLMChain({ prompt, llm: model });
  const res = await chain.call({ foo: "my favorite color" });
  console.log({ res });
});

test("Load chain from hub", async () => {
  const chain = await loadChain("lc://chains/hello-world/chain.json");
  const res = await chain.call({ topic: "my favorite color" });
  console.log({ res });
});

test("Test ConversationChain", async () => {
  const model = new OpenAI({});
  const chain = new ConversationChain({ llm: model });
  const res = await chain.call({ input: "my favorite color" });
  console.log({ res });
});
