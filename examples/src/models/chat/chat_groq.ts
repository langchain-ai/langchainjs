import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate } from "@langchain/core/prompts";

const model = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
});
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant"],
  ["human", "{input}"],
]);
const chain = prompt.pipe(model);
const response = await chain.invoke({
  input: "Hello",
});
console.log("response", response);
/**
response AIMessage {
  content: "Hello! I'm happy to assist you in any way I can. Is there something specific you need help with or a question you have?",
}
 */
