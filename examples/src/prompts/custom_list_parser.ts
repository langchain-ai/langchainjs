import { OpenAI } from "langchain/llms/openai";
import { PromptTemplate } from "langchain/prompts";
import { CustomListOutputParser } from "langchain/output_parsers";

// With a `CustomListOutputParser`, we can parse a list with a specific length and separator.
const parser = new CustomListOutputParser({ length: 3, separator: "\n" });

const formatInstructions = parser.getFormatInstructions();

const prompt = new PromptTemplate({
  template: "Provide a list of {subject}.\n{format_instructions}",
  inputVariables: ["subject"],
  partialVariables: { format_instructions: formatInstructions },
});

const model = new OpenAI({ temperature: 0 });

const input = await prompt.format({
  subject: "great fiction books (book, author)",
});

const response = await model.call(input);

console.log(input);
/*
Provide a list of great fiction books (book, author).
Your response should be a list of 3 items separated by "\n" (eg: `foo\n bar\n baz`)
*/

console.log(response);
/*
The Catcher in the Rye, J.D. Salinger
To Kill a Mockingbird, Harper Lee
The Great Gatsby, F. Scott Fitzgerald
*/

console.log(await parser.parse(response));
/*
[
  'The Catcher in the Rye, J.D. Salinger',
  'To Kill a Mockingbird, Harper Lee',
  'The Great Gatsby, F. Scott Fitzgerald'
]
*/
