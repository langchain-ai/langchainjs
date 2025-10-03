import { OpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { CommaSeparatedListOutputParser } from "@langchain/core/output_parsers";

export const run = async () => {
  // With a `CommaSeparatedListOutputParser`, we can parse a comma separated list.
  const parser = new CommaSeparatedListOutputParser();

  const formatInstructions = parser.getFormatInstructions();

  const prompt = new PromptTemplate({
    template: "List five {subject}.\n{format_instructions}",
    inputVariables: ["subject"],
    partialVariables: { format_instructions: formatInstructions },
  });

  const model = new OpenAI({ temperature: 0 });

  const input = await prompt.format({ subject: "ice cream flavors" });
  const response = await model.invoke(input);

  console.log(input);
  /*
   List five ice cream flavors.
   Your response should be a list of comma separated values, eg: `foo, bar, baz`
  */

  console.log(response);
  // Vanilla, Chocolate, Strawberry, Mint Chocolate Chip, Cookies and Cream

  console.log(await parser.parse(response));
  /*
  [
    'Vanilla',
    'Chocolate',
    'Strawberry',
    'Mint Chocolate Chip',
    'Cookies and Cream'
  ]
  */
};
