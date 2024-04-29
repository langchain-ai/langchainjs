import { LunaryHandler } from "@langchain/community/callbacks/handlers/lunary";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

import lunary from "lunary";

const chat = new ChatOpenAI({
  model: "gpt-4",
  callbacks: [new LunaryHandler()],
});

async function TranslatorAgent(query: string) {
  const res = await chat.invoke([
    new SystemMessage(
      "You are a translator agent that hides jokes in each translation."
    ),
    new HumanMessage(
      `Translate this sentence from English to French: ${query}`
    ),
  ]);

  return res.content;
}

// By wrapping the agent with wrapAgent, we automatically track all input, outputs and errors
// And tools and logs will be tied to the correct agent
const translate = lunary.wrapAgent(TranslatorAgent);

// You can use .identify() on wrapped methods to track users
const res = await translate("Good morning").identify("user123");

console.log(res);
