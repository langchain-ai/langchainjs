import { ChatMistralAI } from "@langchain/mistralai";
import { ChatPromptTemplate } from "langchain/prompts";

const model = new ChatMistralAI({
  apiKey: process.env.MISTRAL_API_KEY,
  modelName: "mistral-small",
});
const prompt = ChatPromptTemplate.fromMessages([
  ["ai", "You are a helpful assistant"],
  ["human", "{input}"]
]);
const chain = prompt.pipe(model);
const response = await chain.stream({
  input: "Hello"
});
for await (const item of response) {
  console.log(item);
}
/**
 * <ADD_RESULT>
 */
