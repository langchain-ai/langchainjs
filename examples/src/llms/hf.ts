import { HuggingFaceInference } from "@langchain/community/llms/hf";

export const run = async () => {
  const model = new HuggingFaceInference({
    modelName: "gpt2",
    temperature: 0.7,
    maxTokens: 50,
  });
  const res = await model.invoke(
    "Question: What would be a good company name a company that makes colorful socks?\nAnswer:"
  );
  console.log({ res });
};
