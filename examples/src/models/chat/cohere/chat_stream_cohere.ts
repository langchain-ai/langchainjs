import { ChatCohere } from "@langchain/cohere";
import { ChatPromptTemplate } from "langchain/prompts";
import { StringOutputParser } from "langchain/schema/output_parser";

const model = new ChatCohere({
  apiKey: process.env.COHERE_API_KEY, // Default
  model: "command", // Default
});
const prompt = ChatPromptTemplate.fromMessages([
  ["ai", "You are a helpful assistant"],
  ["human", "{input}"],
]);
const outputParser = new StringOutputParser();
const chain = prompt.pipe(model).pipe(outputParser);
const response = await chain.stream({
  input: "Why is the sky blue? Be concise with your answer.",
});
let streamTokens = "";
let streamIters = 0;
for await (const item of response) {
  streamTokens += item;
  streamIters += 1;
}
console.log("stream tokens:", streamTokens);
console.log("stream iters:", streamIters);
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
