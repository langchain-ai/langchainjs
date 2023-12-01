import { GradientLLM } from "langchain/llms/gradient_ai";

// Note that inferenceParameters are optional
const model = new GradientLLM({
  modelSlug: "llama2-7b-chat",
  inferenceParameters: {
    maxGeneratedTokenCount: 20,
    temperature: 0,
  },
});
const res = await model.invoke(
  "What would be a good company name for a company that makes colorful socks?"
);

console.log({ res });
