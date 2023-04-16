import { test } from "@jest/globals";
import { OpenAI } from "../../llms/openai.js";
import { PromptTemplate } from "../../prompts/index.js";
import { LLMChain } from "../llm_chain.js";
import { SimpleSequentialChain } from "../simple_sequential_chain.js";
import { ChatOpenAI } from "../../chat_models/openai.js";

test("Test SimpleSequentialChain example usage", async () => {
  // This is an LLMChain to write a synopsis given a title of a play.
  const llm = new OpenAI({ temperature: 0 });
  const template = `You are a playwright. Given the title of play, it is your job to write a synopsis for that title.
    
     Title: {title}
     Playwright: This is a synopsis for the above play:`;
  const promptTemplate = new PromptTemplate({
    template,
    inputVariables: ["title"],
  });
  const synopsisChain = new LLMChain({ llm, prompt: promptTemplate });

  // This is an LLMChain to write a review of a play given a synopsis.
  const reviewLLM = new OpenAI({ temperature: 0 });
  const reviewTemplate = `You are a play critic from the New York Times. Given the synopsis of play, it is your job to write a review for that play.
    
     Play Synopsis:
     {synopsis}
     Review from a New York Times play critic of the above play:`;
  const reviewPromptTempalte = new PromptTemplate({
    template: reviewTemplate,
    inputVariables: ["synopsis"],
  });
  const reviewChain = new LLMChain({
    llm: reviewLLM,
    prompt: reviewPromptTempalte,
  });

  const overallChain = new SimpleSequentialChain({
    chains: [synopsisChain, reviewChain],
    verbose: true,
  });
  const review = await overallChain.run("Tragedy at sunset on the beach");
  expect(review.trim()).toMatchInlineSnapshot(`
    "Tragedy at Sunset on the Beach is a powerful and moving story of love, loss, and redemption. The play follows the story of two young lovers, Jack and Jill, whose plans for a future together are tragically cut short when Jack is killed in a car accident. The play follows Jill as she struggles to cope with her grief and eventually finds solace in the arms of another man. 

    The play is beautifully written and the performances are outstanding. The actors bring the characters to life with their heartfelt performances, and the audience is taken on an emotional journey as Jill is forced to confront her grief and make a difficult decision between her past and her future. The play culminates in a powerful climax that will leave the audience in tears. 

    Overall, Tragedy at Sunset on the Beach is a powerful and moving story that will stay with you long after the curtain falls. It is a must-see for anyone looking for an emotionally charged and thought-provoking experience."
  `);
});

test("Test SimpleSequentialChain serialize/deserialize", async () => {
  const llm1 = new ChatOpenAI();
  const template1 = `Echo back "{foo}"`;
  const promptTemplate1 = new PromptTemplate({
    template: template1,
    inputVariables: ["foo"],
  });
  const chain1 = new LLMChain({ llm: llm1, prompt: promptTemplate1 });

  const llm2 = new ChatOpenAI();
  const template2 = `Echo back "{bar}"`;
  const promptTemplate2 = new PromptTemplate({
    template: template2,
    inputVariables: ["bar"],
  });
  const chain2 = new LLMChain({
    llm: llm2,
    prompt: promptTemplate2,
  });

  const sampleSequentialChain = new SimpleSequentialChain({
    chains: [chain1, chain2],
    verbose: true,
  });

  const serializedChain = sampleSequentialChain.serialize();
  expect(serializedChain._type).toEqual("simple_sequential_chain");
  expect(serializedChain.chains.length).toEqual(2);
  const deserializedChain = await SimpleSequentialChain.deserialize(
    serializedChain
  );
  expect(deserializedChain.chains.length).toEqual(2);
  expect(deserializedChain._chainType).toEqual("simple_sequential_chain");
  const review = await deserializedChain.run("test");
  expect(review.trim()).toMatchInlineSnapshot(`"Test."`);
});
