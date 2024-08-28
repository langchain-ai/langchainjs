import { ChatDeepInfra } from "@langchain/community/chat_models/deepinfra";
import { HumanMessage } from "@langchain/core/messages";

const apiKey = process.env.DEEPINFRA_API_TOKEN;

const model = "meta-llama/Meta-Llama-3-70B-Instruct";

const chat = new ChatDeepInfra({
  model,
  apiKey,
});

const messages = [new HumanMessage("Hello")];

const res = await chat.invoke(messages);

console.log(res);
