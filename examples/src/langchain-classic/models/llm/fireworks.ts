import { Fireworks } from "@langchain/fireworks";

const model = new Fireworks({
  temperature: 0.9,
  // In Node.js defaults to process.env.FIREWORKS_API_KEY
  apiKey: "YOUR-API-KEY",
});
