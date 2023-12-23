import { LunaryHandler } from "@langchain/community/callbacks/handlers/lunary";
import { ChatOpenAI } from "langchain/chat_models/openai";

const model = new ChatOpenAI({
  callbacks: [new LunaryHandler()],
});
