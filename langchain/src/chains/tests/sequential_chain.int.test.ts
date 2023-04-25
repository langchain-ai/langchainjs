import { test } from "@jest/globals";
import { OpenAI } from "../../llms/openai.js";
import { PromptTemplate } from "../../prompts/index.js";
import { LLMChain } from "../llm_chain.js";
import { SequentialChain } from "../sequential_chain.js";
import { ChatOpenAI } from "../../chat_models/openai.js";

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
  const reviewPromptTempalte = new PromptTemplate({
    template: reviewTemplate,
    inputVariables: ["synopsis"],
  });
  const reviewChain = new LLMChain({
    llm: reviewLLM,
    prompt: reviewPromptTempalte,
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
  expect(review).toMatchInlineSnapshot(`
    {
      "review": "

    Tragedy at Sunset on the Beach is a captivating and heartbreaking story of love and loss. Set in Victorian England, the play follows Emily, a young woman struggling to make ends meet in a small coastal town. Emily's dreams of a better life are dashed when she discovers her employer's scandalous affair, and her plans are further thwarted when she meets a handsome stranger on the beach.

    The play is a powerful exploration of the human condition, as Emily must grapple with the truth and make a difficult decision that will change her life forever. The performances are outstanding, with the actors bringing a depth of emotion to their characters that is both heartbreaking and inspiring.

    Overall, Tragedy at Sunset on the Beach is a beautiful and moving play that will leave audiences in tears. It is a must-see for anyone looking for a powerful and thought-provoking story.",
      "synopsis": "

    Tragedy at Sunset on the Beach is a play set in Victorian England. It tells the story of a young woman, Emily, who is struggling to make ends meet in a small coastal town. She works as a maid for a wealthy family, but her dreams of a better life are dashed when she discovers that her employer is involved in a scandalous affair.

    Emily is determined to make a better life for herself, but her plans are thwarted when she meets a handsome stranger on the beach one evening. The two quickly fall in love, but their happiness is short-lived when Emily discovers that the stranger is actually a member of the wealthy family she works for.

    The play follows Emily as she struggles to come to terms with the truth and make sense of her life. As the sun sets on the beach, Emily must decide whether to stay with the man she loves or to leave him and pursue her dreams. In the end, Emily must make a heartbreaking decision that will change her life forever.",
    }
  `);
});

test.skip("Test SequentialChain serialize/deserialize", async () => {
  const llm1 = new ChatOpenAI();
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

  const llm2 = new ChatOpenAI();
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
