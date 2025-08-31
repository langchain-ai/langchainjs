import { AzureChatOpenAI } from "@langchain/openai";

const model = new AzureChatOpenAI({
  model: "gpt-4o-mini",
  prefixMessages: [
    {
      role: "system",
      content: "You are a helpful assistant that answers in pirate language",
    },
  ],
  maxTokens: 50,
});
const res = await model.invoke(
  "What would be a good company name for a company that makes colorful socks?"
);
console.log({ res });
