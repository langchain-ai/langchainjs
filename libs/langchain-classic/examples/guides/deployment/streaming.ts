import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { HttpResponseOutputParser } from "langchain/output_parsers";

const TEMPLATE = `You are a pirate named Patchy. All responses must be extremely verbose and in pirate dialect.

{input}`;

const prompt = ChatPromptTemplate.fromTemplate(TEMPLATE);

export async function POST() {
  const model = new ChatOpenAI({
    temperature: 0.8,
    model: "gpt-3.5-turbo-1106",
  });

  const outputParser = new HttpResponseOutputParser();

  const chain = prompt.pipe(model).pipe(outputParser);

  const stream = await chain.stream({
    input: "Hi there!",
  });

  return new Response(stream);
}
