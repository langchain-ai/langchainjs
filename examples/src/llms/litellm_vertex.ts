import { ChatOpenAI } from "@langchain/openai";


const model = new ChatOpenAI({
  model: "gemini-pro",
  openAIApiKey: "sk-1234",
}, {
  basePath: "http://0.0.0.0:4000",
});

const message = await model.invoke("Hi there!");

console.log(message);