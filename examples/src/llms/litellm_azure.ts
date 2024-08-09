import { ChatOpenAI } from "@langchain/openai";


const model = new ChatOpenAI({
  model: "gpt-azure",
  openAIApiKey: "sk-1234",
  modelKwargs: {"metadata": "hello world"} // 👈 PASS Additional params here
}, {
  basePath: "http://0.0.0.0:4000",
});

const message = await model.invoke("Hi there!");

console.log(message);