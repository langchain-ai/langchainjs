# Few Shot Examples

Few shot examples are a set of examples that can be used to help the language model generate a better response.

To generate a prompt with few shot examples, you can use the FewShotPromptTemplate. This class takes in a PromptTemplate and a list of few shot examples. It then formats the prompt template with the few shot examples.

In this example, we’ll create a prompt to generate word antonyms.

```typescript
import { FewShotPromptTemplate, PromptTemplate } from "langchain/prompts";

/* First, create the list of few shot examples. */
const examples = [
  { word: "happy", antonym: "sad" },
  { word: "tall", antonym: "short" },
];
/** Next, we specify the template to format the examples we have provided.
We use the `PromptTemplate` class for this. */
const exampleFormatterTemplate = "Word: {word}\nAntonym: {antonym}\n";
const examplePrompt = new PromptTemplate({
  inputVariables: ["word", "antonym"],
  template: exampleFormatterTemplate,
});
/*# Finally, we create the `FewShotPromptTemplate` object.*/
const fewShotPrompt = new FewShotPromptTemplate({
  /* These are the examples we want to insert into the prompt.*/
  examples: examples,
  /*This is how we want to format the examples when we insert them into the prompt.*/
  examplePrompt: examplePrompt,
  /*The prefix is some text that goes before the examples in the prompt. Usually, this consists of intructions.*/
  prefix: "Give the antonym of every input",
  /*The suffix is some text that goes after the examples in the prompt. Usually, this is where the user input will go*/
  suffix: "Word: {input}\nAntonym:",
  /*The input variables are the variables that the overall prompt expects.*/
  inputVariables: ["input"],
  /*The example_separator is the string we will use to join the prefix, examples, and suffix together with.*/
  exampleSeparator: "\n\n",
  /* The template format is the formatting method to use for the template. Should usually be f-string. */
  templateFormat: "f-string",
});
/*We can now generate a prompt using the `format` method.*/
const res = fewShotPrompt.format({ input: "big" });
console.log({ res });
```
