import { LunaryHandler } from "@langchain/community/callbacks/handlers/lunary";
import { ChatOpenAI } from "langchain/chat_models/openai";

const chat = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  temperature: 0,
  callbacks: [new LunaryHandler()],
});

await chat.invoke("Hello", {
  tags: ["greeting"],
});
