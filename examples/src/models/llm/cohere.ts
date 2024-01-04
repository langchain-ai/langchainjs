import { Cohere } from "@langchain/cohere";

const model = new Cohere({
  maxTokens: 20,
  apiKey: "YOUR-API-KEY", // In Node.js defaults to process.env.COHERE_API_KEY
});
const res = await model.invoke(
  "What would be a good company name a company that makes colorful socks?"
);
console.log({ res });
