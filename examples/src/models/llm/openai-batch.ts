import { OpenAI, ChatOpenAI } from "@langchain/openai";
import process from "process";
import { HumanMessage } from "@langchain/core/messages";

process.env.LANGCHAIN_TRACING_V2 = "true";

const model = new OpenAI({});

const prompts = [
  "Say hello to Bob.",
  "Say hello to Alice.",
  "Say hello to John.",
  "Say hello to Mary.",
];

const res = await model.invoke(prompts);
console.log({ res });

const chat = new ChatOpenAI({
  model: "gpt-3.5-turbo",
});

const messages = prompts.map((prompt) => new HumanMessage(prompt));

const res2 = await chat.invoke(messages);
console.log({ res2 });
