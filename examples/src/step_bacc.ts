/**
 * @TODO delete this file before opening PR.
 */
import { ChatOpenAI } from "langchain/chat_models/openai";
import { pull } from "langchain/hub";
import {
  ChatPromptTemplate,
  FewShotChatMessagePromptTemplate,
} from "langchain/prompts";
import { StringOutputParser } from "langchain/schema/output_parser";
import { RunnableSequence } from "langchain/schema/runnable";
import { SerpAPI } from "langchain/tools";

const model = new ChatOpenAI({ temperature: 0 });
const stringOutputParser = new StringOutputParser();

const examples = [
  {
    input: "Could the members of The Police perform lawful arrests?",
    output: "what can the members of The Police do?",
  },
  {
    input: "Jan Sindel's was born in what country?",
    output: "what is Jan Sindel's personal history?",
  },
];
const examplePrompt = ChatPromptTemplate.fromMessages([
  ["human", "{input}"],
  ["ai", "{output}"],
]);
const fewShotPrompt = new FewShotChatMessagePromptTemplate({
  examplePrompt,
  examples,
  inputVariables: ["question"],
});

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are an expert at world knowledge. Your task is to step back and paraphrase a question to a more generic step-back question, which is easier to answer. Here are a few examples:`,
  ],
  fewShotPrompt,
  ["user", "{question}"],
]);

const questionGenerator = RunnableSequence.from([
  prompt,
  model,
  stringOutputParser,
]);

const { SERPAPI_API_KEY } = process.env;
if (!SERPAPI_API_KEY) {
  throw new Error("Missing SERPAPI_API_KEY");
}

const search = new SerpAPI(SERPAPI_API_KEY, {
  num: "4",
});

const retriever = async (query: string) => search.call(query);

// const responsePromptTemplate = `You are an expert of world knowledge. I am going to ask you a question. Your response should be comprehensive and not contradicted with the following context if they are relevant. Otherwise, ignore them if they are not relevant.

// {normal_context}
// {step_back_context}

// Original Question: {question}
// Answer:`;
// const responsePrompt = ChatPromptTemplate.fromTemplate(responsePromptTemplate)
const responsePrompt = await pull("langchain-ai/stepback-answer");

const chain = RunnableSequence.from([
  {
    normal_context: (i: { question: string }) => retriever(i.question),
    step_back_context: questionGenerator.pipe(retriever),
    question: (i: { question: string }) => i.question,
  },
  responsePrompt,
  model,
  stringOutputParser,
]);

const question = "was chatgpt around while trump was president?";
const responseOne = await chain.invoke({
  question,
});
console.log("responseOne: ", responseOne);
/**
responseOne:  Yes, ChatGPT was around while Donald Trump was president. ChatGPT is an AI language model developed by OpenAI, and it was first introduced in June 2020. It has been trained on a vast amount of text data from the internet, allowing it to generate human-like responses to various prompts and questions. Therefore, ChatGPT was available and operational during the time when Donald Trump served as the President of the United States from January 20, 2017, to January 20, 2021.
 */
