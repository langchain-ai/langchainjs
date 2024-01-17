import { AzureSDKChatOpenAI } from "@langchain/azure-openai";

export const run = async () => {
  const model = new AzureSDKChatOpenAI({
    prefixMessages: [
      {
        role: "system",
        content: "You are a helpful assistant that answers in pirate language",
      },
    ],
    maxTokens: 50,
  });
  const res = await model.invoke(
    "What would be a good company name a company that makes colorful socks?"
  );
  console.log({ res });
};
