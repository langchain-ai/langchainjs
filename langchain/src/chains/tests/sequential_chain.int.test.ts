import { test } from "@jest/globals";
import { OpenAI, ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { LLMChain } from "../llm_chain.js";
import { SequentialChain } from "../sequential_chain.js";

test("Test SequentialChain example usage", async () => {
  // This is an LLMChain to write a synopsis given a title of a play and the era it is set in.
  const llm = new OpenAI({ temperature: 0 });
  const template = `You are a playwright. Given the title of play and the era it is set in, it is your job to write a synopsis for that title.

  Title: {title}
  Era: {era}
  Playwright: This is a synopsis for the above play:`;
  const promptTemplate = new PromptTemplate({
    template,
    inputVariables: ["title", "era"],
  });
  const synopsisChain = new LLMChain({
    llm,
    prompt: promptTemplate,
    outputKey: "synopsis",
  });

  // This is an LLMChain to write a review of a play given a synopsis.
  const reviewLLM = new OpenAI({ temperature: 0 });
  const reviewTemplate = `You are a play critic from the New York Times. Given the synopsis of play, it is your job to write a review for that play.
    
     Play Synopsis:
     {synopsis}
     Review from a New York Times play critic of the above play:`;
  const reviewPromptTemplate = new PromptTemplate({
    template: reviewTemplate,
    inputVariables: ["synopsis"],
  });
  const reviewChain = new LLMChain({
    llm: reviewLLM,
    prompt: reviewPromptTemplate,
    outputKey: "review",
  });

  const overallChain = new SequentialChain({
    chains: [synopsisChain, reviewChain],
    inputVariables: ["era", "title"],
    // Here we return multiple variables
    outputVariables: ["synopsis", "review"],
    verbose: true,
  });
  const review = await overallChain.call({
    title: "Tragedy at sunset on the beach",
    era: "Victorian England",
  });
  expect(review.review.toLowerCase()).toContain(
    "tragedy at sunset on the beach"
  );
});

test.skip("Test SequentialChain serialize/deserialize", async () => {
  const llm1 = new ChatOpenAI({ model: "gpt-4o-mini" });
  const template1 = `Echo back "{foo} {bar}"`;
  const promptTemplate1 = new PromptTemplate({
    template: template1,
    inputVariables: ["foo", "bar"],
  });
  const chain1 = new LLMChain({
    llm: llm1,
    prompt: promptTemplate1,
    outputKey: "baz",
  });

  const llm2 = new ChatOpenAI({ model: "gpt-4o-mini" });
  const template2 = `Echo back "{baz}"`;
  const promptTemplate2 = new PromptTemplate({
    template: template2,
    inputVariables: ["baz"],
  });
  const chain2 = new LLMChain({
    llm: llm2,
    prompt: promptTemplate2,
  });

  const sampleSequentialChain = new SequentialChain({
    chains: [chain1, chain2],
    inputVariables: ["foo", "bar"],
    outputVariables: ["text"],
    verbose: true,
  });

  const serializedChain = sampleSequentialChain.serialize();
  expect(serializedChain._type).toEqual("sequential_chain");
  expect(serializedChain.chains.length).toEqual(2);
  const deserializedChain = await SequentialChain.deserialize(serializedChain);
  expect(deserializedChain.chains.length).toEqual(2);
  expect(deserializedChain._chainType).toEqual("sequential_chain");
  const review = await deserializedChain.call({ foo: "test1", bar: "test2" });
  expect(review.trim()).toMatchInlineSnapshot(`"test1 test2"`);
});
