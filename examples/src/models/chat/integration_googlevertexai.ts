import { ChatGoogleVertexAI } from "langchain/chat_models/googlevertexai";
// Or, if using the web entrypoint:
// import { ChatGoogleVertexAI } from "langchain/chat_models/googlevertexai/web";

const model = new ChatGoogleVertexAI({
  temperature: 0.7,
});
