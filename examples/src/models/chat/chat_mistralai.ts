import { ChatMistralAI } from "@langchain/mistralai";
import { ChatPromptTemplate } from "langchain/prompts";

const model = new ChatMistralAI({
  apiKey: process.env.MISTRAL_API_KEY,
  modelName: "mistral-small",
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
  lc_namespace: [ 'langchain_core', 'messages' ],
  content: "Hello! I'm here to help answer any questions you might have or provide information on a variety of topics. How can I assist you today?\n" +
    '\n' +
    'Here are some common tasks I can help with:\n' +
    '\n' +
    '* Setting alarms or reminders\n' +
    '* Sending emails or messages\n' +
    '* Making phone calls\n' +
    '* Providing weather information\n' +
    '* Creating to-do lists\n' +
    '* Offering suggestions for restaurants, movies, or other local activities\n' +
    '* Providing definitions and explanations for words or concepts\n' +
    '* Translating text into different languages\n' +
    '* Playing music or podcasts\n' +
    '* Setting timers\n' +
    '* Providing directions or traffic information\n' +
    '* And much more!\n' +
    '\n' +
    "Let me know how I can help you specifically, and I'll do my best to make your day easier and more productive!\n" +
    '\n' +
    'Best regards,\n' +
    'Your helpful assistant.',
  name: undefined,
  additional_kwargs: {}
}
 */
