import { ChatPerplexity } from "@langchain/community/chat_models/perplexity";
import { HumanMessage } from "@langchain/core/messages";

const model = new ChatPerplexity({
  // In Node.js defaults to process.env.PERPLEXITY_API_KEY
  apiKey: "YOUR-API-KEY",
  // Optional: Specify the model name
  model: "sonar",
});

console.log(await model.invoke([new HumanMessage("Hello there!")]));
