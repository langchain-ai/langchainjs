import { OpenAI } from "langchain/llms/openai";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanMessage } from "langchain/schema";
import process from "process";

process.env.LANGCHAIN_TRACING_V2 = "true";

const model = new OpenAI({});

const prompts = [
  "Say hello to Bob.",
  "Say hello to Alice.",
  "Say hello to John.",
  "Say hello to Mary.",
];

const res = await model.generate(prompts);
console.log({ res });

const chat = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
});

const messages = prompts.map((prompt) => [new HumanMessage(prompt)]);

const res2 = await chat.generate(messages);
console.log({ res2 });
