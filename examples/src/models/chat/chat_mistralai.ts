import { ChatMistralAI } from "@langchain/mistralai";
import { ChatPromptTemplate } from "langchain/prompts";

const model = new ChatMistralAI({
  apiKey: process.env.MISTRAL_API_KEY,
  modelName: "mistral-small"
});
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant"],
  ["human", "{input}"]
]);
const chain = prompt.pipe(model);
const response = await chain.invoke({
  input: "Hello"
});
console.log("response", response);
/**
 * response <ADD_RESULT>
 */
