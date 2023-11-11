import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import {
  SemanticSimilarityExampleSelector,
  PromptTemplate,
  FewShotPromptTemplate,
} from "langchain/prompts";
import { HNSWLib } from "langchain/vectorstores/hnswlib";

// Create a prompt template that will be used to format the examples.
const examplePrompt = PromptTemplate.fromTemplate(
  "Input: {input}\nOutput: {output}"
);

// Create a SemanticSimilarityExampleSelector that will be used to select the examples.
const exampleSelector = await SemanticSimilarityExampleSelector.fromExamples(
  [
    { input: "happy", output: "sad" },
    { input: "tall", output: "short" },
    { input: "energetic", output: "lethargic" },
    { input: "sunny", output: "gloomy" },
    { input: "windy", output: "calm" },
  ],
  new OpenAIEmbeddings(),
  HNSWLib,
  { k: 1 }
);

// Create a FewShotPromptTemplate that will use the example selector.
const dynamicPrompt = new FewShotPromptTemplate({
  // We provide an ExampleSelector instead of examples.
  exampleSelector,
  examplePrompt,
  prefix: "Give the antonym of every input",
  suffix: "Input: {adjective}\nOutput:",
  inputVariables: ["adjective"],
});

// Input is about the weather, so should select eg. the sunny/gloomy example
console.log(await dynamicPrompt.format({ adjective: "rainy" }));
/*
  Give the antonym of every input

  Input: sunny
  Output: gloomy

  Input: rainy
  Output:
*/

// Input is a measurement, so should select the tall/short example
console.log(await dynamicPrompt.format({ adjective: "large" }));
/*
  Give the antonym of every input

  Input: tall
  Output: short

  Input: large
  Output:
*/
