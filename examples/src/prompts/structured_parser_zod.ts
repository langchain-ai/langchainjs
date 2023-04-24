import { z } from "zod";
import { OpenAI } from "langchain/llms/openai";
import { PromptTemplate } from "langchain/prompts";
import { StructuredOutputParser } from "langchain/output_parsers";

export const run = async () => {
  // We can use zod to define a schema for the output using the `fromZodSchema` method of `StructuredOutputParser`.
  const parser = StructuredOutputParser.fromZodSchema(
    z.object({
      answer: z.string().describe("answer to the user's question"),
      sources: z
        .array(z.string())
        .describe("sources used to answer the question, should be websites."),
    })
  );

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
  */

  console.log(response);
  /*
  ```json
  {
      "answer": "The capital of France is Paris.",
      "sources": ["https://www.worldatlas.com/articles/what-is-the-capital-of-france.html"]
  }
  ```
  */

  console.log(parser.parse(response));
  /*
  {
    answer: 'The capital of France is Paris.',
    sources: [
      'https://www.worldatlas.com/articles/what-is-the-capital-of-france.html'
    ]
  }
  */
};
