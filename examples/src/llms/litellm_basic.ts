import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  model: "claude-3-5-sonnet-20240620", // swap this for "gpt-4o-mini", "gemini-1.5-pro", "claude-3-5-sonnet-20240620"
  openAIApiKey: "sk-1234",
}, {
  basePath: "http://0.0.0.0:4000", // set basePath to LiteLLM Proxy server
});

const message = await model.invoke("Hi there!");

console.log(message);