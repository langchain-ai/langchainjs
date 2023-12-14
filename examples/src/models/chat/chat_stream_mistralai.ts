import { ChatMistralAI } from "@langchain/mistralai";
import { ChatPromptTemplate } from "langchain/prompts";
import { StringOutputParser } from "langchain/schema/output_parser";

const model = new ChatMistralAI({
  apiKey: process.env.MISTRAL_API_KEY,
  modelName: "mistral-small",
});
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant"],
  ["human", "{input}"],
]);
const outputParser = new StringOutputParser();
const chain = prompt.pipe(model).pipe(outputParser);
const response = await chain.stream({
  input: "Hello",
});
for await (const item of response) {
  console.log("stream item:", item);
}
/**
stream item:
stream item: Hello! I'm here to help answer any questions you
stream item:  might have or assist you with any task you'd like to
stream item:  accomplish. I can provide information
stream item:  on a wide range of topics
stream item: , from math and science to history and literature. I can
stream item:  also help you manage your schedule, set reminders, and
stream item:  much more. Is there something specific you need help with? Let
stream item:  me know!
stream item:
 */
