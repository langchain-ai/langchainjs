import { OpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { CommaSeparatedListOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";

export const run = async () => {
  // With a `CommaSeparatedListOutputParser`, we can parse a comma separated list.
  const parser = new CommaSeparatedListOutputParser();

  const chain = RunnableSequence.from([
    PromptTemplate.fromTemplate("List five {subject}.\n{format_instructions}"),
    new OpenAI({ temperature: 0 }),
    parser,
  ]);

  /*
   List five ice cream flavors.
   Your response should be a list of comma separated values, eg: `foo, bar, baz`
  */
  const response = await chain.invoke({
    subject: "ice cream flavors",
    format_instructions: parser.getFormatInstructions(),
  });

  console.log(response);
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
