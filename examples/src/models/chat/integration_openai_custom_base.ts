import { ChatOpenAI } from "langchain/chat_models/openai";

const model = new ChatOpenAI({
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
