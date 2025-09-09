import { OpenAI, ChatOpenAI } from "@langchain/openai";
import * as process from "process";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

export const run = async () => {
  process.env.LANGCHAIN_HANDLER = "langchain";
  const model = new OpenAI({ model: "gpt-4o-mini", temperature: 0.9 });
  const resA = await model.invoke(
    "What would be a good company name a company that makes colorful socks?"
  );
  console.log({ resA });

  const chat = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 });
  const system_message = new SystemMessage("You are to chat with a user.");
  const message = new HumanMessage("Hello!");
  const resB = await chat.invoke([system_message, message]);
  console.log({ resB });
};
