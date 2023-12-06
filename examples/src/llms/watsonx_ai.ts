import { WatsonxAI } from "langchain/llms/watsonx_ai";

// Note that modelParameters are optional
const model = new WatsonxAI({
  modelId: "meta-llama/llama-2-70b-chat",
  modelParameters: {
    max_new_tokens: 100,
    min_new_tokens: 0,
    stop_sequences: [],
    repetition_penalty: 1,
  },
});

const res = await model.invoke(
  "What would be a good company name for a company that makes colorful socks?"
);

console.log({ res });
