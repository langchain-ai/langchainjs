import { PromptTemplate } from "langchain/prompts";

export const run = async () => {
  const template = "What is a good name for a company that makes {product}?";
  const prompt = new PromptTemplate({ template, inputVariables: ["product"] });
  const res = prompt.format({ product: "colorful socks" });
  console.log({ res });
};
