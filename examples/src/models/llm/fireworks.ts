import { Fireworks } from "langchain/llms/fireworks";

const model = new Fireworks({
  temperature: 0.9,
  // In Node.js defaults to process.env.FIREWORKS_API_KEY
  fireworksApiKey: "YOUR-API-KEY",
});
