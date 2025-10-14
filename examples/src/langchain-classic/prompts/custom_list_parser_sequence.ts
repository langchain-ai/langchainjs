import { OpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { CustomListOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";

// With a `CustomListOutputParser`, we can parse a list with a specific length and separator.
const parser = new CustomListOutputParser({ length: 3, separator: "\n" });

const chain = RunnableSequence.from([
  PromptTemplate.fromTemplate(
    "Provide a list of {subject}.\n{format_instructions}"
  ),
  new OpenAI({ temperature: 0 }),
  parser,
]);

/*
Provide a list of great fiction books (book, author).
Your response should be a list of 3 items separated by "\n" (eg: `foo\n bar\n baz`)
*/
const response = await chain.invoke({
  subject: "great fiction books (book, author)",
  format_instructions: parser.getFormatInstructions(),
});

console.log(response);
/*
[
  'The Catcher in the Rye, J.D. Salinger',
  'To Kill a Mockingbird, Harper Lee',
  'The Great Gatsby, F. Scott Fitzgerald'
]
*/
