import { OpenAI } from "langchain/llms/openai";
import { PromptTemplate } from "langchain/prompts";
import { StructuredOutputParser } from "langchain/output_parsers";
import { RunnableSequence } from "langchain/schema/runnable";

const parser = StructuredOutputParser.fromNamesAndDescriptions({
  answer: "answer to the user's question",
  source: "source used to answer the user's question, should be a website.",
});

const response = await RunnableSequence.from([
  PromptTemplate.fromTemplate(
    "Answer the users question as best as possible.\n{format_instructions}\n{question}"
  ),
  new OpenAI({ temperature: 0 }),
  parser,
]).invoke({
  question: "What is the capital of France?",
  format_instructions: parser.getFormatInstructions(),
});

console.log(response);
// { answer: 'Paris', source: 'https://en.wikipedia.org/wiki/Paris' }
