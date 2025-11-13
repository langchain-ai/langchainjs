import { Fireworks } from "@langchain/community/llms/fireworks";

const model = new Fireworks({
  temperature: 0.9,
  // In Node.js defaults to process.env.FIREWORKS_API_KEY
  apiKey: "YOUR-API-KEY",
});
