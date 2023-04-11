import { OpenAI } from "langchain/llms/openai";
import { PromptTemplate } from "langchain/prompts";
import {
  StructuredOutputParser,
  RegexParser,
  CombiningOutputParser,
} from "langchain/output_parsers";

export const run = async () => {
  const answerParser = StructuredOutputParser.fromNamesAndDescriptions({
    answer: "answer to the user's question",
    source: "source used to answer the user's question, should be a website.",
  });

  const confidenceParser = new RegexParser(
    /Confidence: (A|B|C), Explanation: (.*)/,
    ["confidence", "explanation"],
    "noConfidence"
  );

  const parser = new CombiningOutputParser(answerParser, confidenceParser);
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
  For your first output: The output should be a markdown code snippet formatted in the following schema:

  ```json
  {
      "answer": string // answer to the user's question
      "source": string // source used to answer the user's question, should be a website.
  }
  ```
  Complete that output fully. Then produce another output: Your response should match the following regex: //Confidence: (A|B|C), Explanation: (.*)//

  What is the capital of France?
  */

  console.log(response);
  /*
  ```json
  {
      "answer": "Paris",
      "source": "https://en.wikipedia.org/wiki/France"
  }
  ```
  //Confidence: A, Explanation: Paris is the capital of France according to Wikipedia.//
  */

  console.log(await parser.parse(response));
  /*
  {
    answer: 'Paris',
    source: 'https://en.wikipedia.org/wiki/France',
    confidence: 'A',
    explanation: 'Paris is the capital of France according to Wikipedia.//'
    }
  */
};
