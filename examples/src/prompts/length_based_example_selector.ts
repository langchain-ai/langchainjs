import { PromptTemplate, FewShotPromptTemplate } from "@langchain/core/prompts";
import { LengthBasedExampleSelector } from "@langchain/core/example_selectors";

export async function run() {
  // Create a prompt template that will be used to format the examples.
  const examplePrompt = new PromptTemplate({
    inputVariables: ["input", "output"],
    template: "Input: {input}\nOutput: {output}",
  });

  // Create a LengthBasedExampleSelector that will be used to select the examples.
  const exampleSelector = await LengthBasedExampleSelector.fromExamples(
    [
      { input: "happy", output: "sad" },
      { input: "tall", output: "short" },
      { input: "energetic", output: "lethargic" },
      { input: "sunny", output: "gloomy" },
      { input: "windy", output: "calm" },
    ],
    {
      examplePrompt,
      maxLength: 25,
    }
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

  // An example with small input, so it selects all examples.
  console.log(await dynamicPrompt.format({ adjective: "big" }));
  /*
   Give the antonym of every input

   Input: happy
   Output: sad

   Input: tall
   Output: short

   Input: energetic
   Output: lethargic

   Input: sunny
   Output: gloomy

   Input: windy
   Output: calm

   Input: big
   Output:
   */

  // An example with long input, so it selects only one example.
  const longString =
    "big and huge and massive and large and gigantic and tall and much much much much much bigger than everything else";
  console.log(await dynamicPrompt.format({ adjective: longString }));
  /*
   Give the antonym of every input

   Input: happy
   Output: sad

   Input: big and huge and massive and large and gigantic and tall and much much much much much bigger than everything else
   Output:
   */
}
