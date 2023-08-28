import { OpenAI } from "langchain/llms/openai";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { SystemMessage, HumanMessage } from "langchain/schema";
import * as process from "process";

export const run = async () => {
  process.env.LANGCHAIN_HANDLER = "langchain";
  const model = new OpenAI({ temperature: 0.9 });
  const resA = await model.call(
    "What would be a good company name a company that makes colorful socks?"
  );
  console.log({ resA });

  const chat = new ChatOpenAI({ temperature: 0 });
  const system_message = new SystemMessage("You are to chat with a user.");
  const message = new HumanMessage("Hello!");
  const resB = await chat.call([system_message, message]);
  console.log({ resB });
};
