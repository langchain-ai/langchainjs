import { OpenAI } from "@langchain/openai";
import { RegexParser } from "langchain/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";

export const run = async () => {
  const parser = new RegexParser(
    /Humor: ([0-9]+), Sophistication: (A|B|C|D|E)/,
    ["mark", "grade"],
    "noConfidence"
  );
  const formatInstructions = parser.getFormatInstructions();

  const prompt = new PromptTemplate({
    template: "Grade the joke.\n\n{format_instructions}\n\nJoke: {joke}",
    inputVariables: ["joke"],
    partialVariables: { format_instructions: formatInstructions },
  });

  const model = new OpenAI({ temperature: 0 });

  const input = await prompt.format({
    joke: "What time is the appointment? Tooth hurt-y.",
  });
  console.log(input);
  /*
  Grade the joke.

  Your response should match the following regex: /Humor: ([0-9]+), Sophistication: (A|B|C|D|E)/

  Joke: What time is the appointment? Tooth hurt-y.
  */

  const response = await model.invoke(input);
  console.log(response);
  /*
  Humor: 8, Sophistication: D
  */
};
