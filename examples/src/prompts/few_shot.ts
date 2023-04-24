import { FewShotPromptTemplate, PromptTemplate } from "langchain/prompts";

export const run = async () => {
  // First, create a list of few-shot examples.
  const examples = [
    { word: "happy", antonym: "sad" },
    { word: "tall", antonym: "short" },
  ];

  // Next, we specify the template to format the examples we have provided.
  const exampleFormatterTemplate = "Word: {word}\nAntonym: {antonym}\n";
  const examplePrompt = new PromptTemplate({
    inputVariables: ["word", "antonym"],
    template: exampleFormatterTemplate,
  });
  // Finally, we create the `FewShotPromptTemplate`
  const fewShotPrompt = new FewShotPromptTemplate({
    /* These are the examples we want to insert into the prompt. */
    examples,
    /* This is how we want to format the examples when we insert them into the prompt. */
    examplePrompt,
    /* The prefix is some text that goes before the examples in the prompt. Usually, this consists of intructions. */
    prefix: "Give the antonym of every input",
    /* The suffix is some text that goes after the examples in the prompt. Usually, this is where the user input will go */
    suffix: "Word: {input}\nAntonym:",
    /* The input variables are the variables that the overall prompt expects. */
    inputVariables: ["input"],
    /* The example_separator is the string we will use to join the prefix, examples, and suffix together with. */
    exampleSeparator: "\n\n",
    /* The template format is the formatting method to use for the template. Should usually be f-string. */
    templateFormat: "f-string",
  });

  // We can now generate a prompt using the `format` method.
  console.log(await fewShotPrompt.format({ input: "big" }));
  /*
  Give the antonym of every input

  Word: happy
  Antonym: sad


  Word: tall
  Antonym: short


  Word: big
  Antonym:
  */
};
