import { OpenAI, PromptTemplate } from "langchain";
import { CommaSeparatedListOutputParser } from "langchain/output_parsers";

export const run = async () => {
  const parser = new CommaSeparatedListOutputParser();

  const formatInstructions = parser.getFormatInstructions();

  const prompt = new PromptTemplate({
    template: "List five {subject}.\n{format_instructions}",
    inputVariables: ["subject"],
    partialVariables: { format_instructions: formatInstructions },
  });

  const model = new OpenAI({ temperature: 0 });

  const input = await prompt.format({ subject: "ice cream flavors" });
  const response = await model.call(input);

  console.log("Prompt:");
  console.log(input);
  console.log("Raw response:");
  console.log(response);
  console.log("Parsed response:");
  console.log(parser.parse(response));
};
