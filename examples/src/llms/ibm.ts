import { WatsonxLLM } from "@langchain/community/llms/ibm";

const props = {
  decoding_method: "sample",
  max_new_tokens: 100,
  min_new_tokens: 1,
  temperature: 0.5,
  top_k: 50,
  top_p: 1,
};
const instance = new WatsonxLLM({
  version: "2024-05-31",
  serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
  projectId: process.env.WATSONX_AI_PROJECT_ID,
  ...props,
});

const result = await instance.invoke("Print hello world.");
console.log(result);

const results = await instance.generate([
  "Print hello world.",
  "Print bye, bye world!",
]);
console.log(results);

const stream = await instance.stream("Print hello world.");
for await (const chunk of stream) {
  console.log(chunk);
}
