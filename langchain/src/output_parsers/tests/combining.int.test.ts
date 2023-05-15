import { test } from "@jest/globals";

import { OpenAI } from "../../llms/openai.js";
import { PromptTemplate } from "../../prompts/index.js";
import {
  StructuredOutputParser,
  RegexParser,
  CombiningOutputParser,
} from "../index.js";

test("CombiningOutputParser", async () => {
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

  console.log(input);

  const response = await model.call(input);

  console.log(response);

  console.log(await parser.parse(response));
});
