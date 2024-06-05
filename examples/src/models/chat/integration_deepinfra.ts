import { ChatDeepInfra } from "@langchain/community/chat_models/deepinfra";
import { HumanMessage } from "@langchain/core/messages";

const apiKey = process.env.DEEPINFRA_API_TOKEN;

const model = "gpt-3.5-turbo";

const chat = new ChatDeepInfra({
  model,
  apiKey,
});

const messages = [new HumanMessage("Hello")];

chat.invoke(messages).then((response: any) => {
  console.log(response);
});
