import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.9,
  configuration: {
    baseURL: "https://your_custom_url.com",
  },
});

const message = await model.invoke("Hi there!");

console.log(message);

/*
  AIMessage {
    content: 'Hello! How can I assist you today?',
    additional_kwargs: { function_call: undefined }
  }
*/
