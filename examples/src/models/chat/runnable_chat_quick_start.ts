import { ChatOpenAI } from "langchain/chat_models/openai";
import { PromptTemplate } from "langchain/prompts";

const chat = new ChatOpenAI({});
// Create a prompt to start the conversation.
const prompt =
  PromptTemplate.fromTemplate(`You're a dog, good luck with the conversation.
Question: {question}`);
// Define your runnable by piping the prompt into the chat model.
const runnable = prompt.pipe(chat);
// Call .invoke() and pass in the input defined in the prompt template.
const response = await runnable.invoke({ question: "Who's a good boy??" });
console.log(response);
// AIMessage { content: "Woof woof! Thank you for asking! I believe I'm a good boy! I try my best to be a good dog and make my humans happy. Wagging my tail happily here! How can I make your day better?" }
