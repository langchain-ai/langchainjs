import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  temperature: 0.9,
  model: "ft:gpt-3.5-turbo-0613:{ORG_NAME}::{MODEL_ID}",
});

const message = await model.invoke("Hi there!");

console.log(message);

/*
  AIMessage {
    content: 'Hello! How can I assist you today?',
    additional_kwargs: { function_call: undefined }
  }
*/
