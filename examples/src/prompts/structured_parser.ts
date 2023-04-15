import { OpenAI } from "langchain/llms/openai";
import { PromptTemplate } from "langchain/prompts";
import { StructuredOutputParser } from "langchain/output_parsers";

export const run = async () => {
  // With a `StructuredOutputParser` we can define a schema for the output.
  const parser = StructuredOutputParser.fromNamesAndDescriptions({
    answer: "answer to the user's question",
    source: "source used to answer the user's question, should be a website.",
  });

  const formatInstructions = parser.getFormatInstructions();

  const prompt = new PromptTemplate({
    template:
      "Answer the users question as best as possible.\n{format_instructions}\n{question}",
    inputVariables: ["question"],
    partialVariables: { format_instructions: formatInstructions },
  });

  const model = new OpenAI({ temperature: 0 });

  const input = await prompt.format({
    question: "What is the capital of France?",
  });
  const response = await model.call(input);

  console.log(input);
  /*
  Answer the users question as best as possible.
  The output should be a markdown code snippet formatted in the following schema:
  ```json
  {
      "answer": string // answer to the user's question
      "source": string // source used to answer the user's question, should be a website.
  }
  ```
  */

  console.log(response);
  /*
  ```json
  {
      "answer": "Paris",
      "source": "https://en.wikipedia.org/wiki/France"
  }
  ```
  */

  console.log(parser.parse(response));
  // { answer: 'Paris', source: 'https://en.wikipedia.org/wiki/France' }
};
