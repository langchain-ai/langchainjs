import { PromptLayerOpenAI } from "langchain/llms/openai";

export const run = async () => {
  const model = new PromptLayerOpenAI({ temperature: 0.9 });
  const res = await model.invoke(
    "What would be a good company name a company that makes colorful socks?"
  );
  console.log({ res });
};
