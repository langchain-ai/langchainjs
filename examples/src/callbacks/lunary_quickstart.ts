import { LunaryHandler } from "@langchain/community/callbacks/handlers/lunary";
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  callbacks: [new LunaryHandler()],
});
