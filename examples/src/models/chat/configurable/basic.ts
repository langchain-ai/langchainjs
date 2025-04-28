import { initChatModel } from "langchain/chat_models/universal";

// Returns a @langchain/openai ChatOpenAI instance.
const gpt4o = await initChatModel("gpt-4o", {
  modelProvider: "openai",
  temperature: 0,
});

// You can also specify the model provider in the model name like this in
// langchain>=0.3.18:

// Returns a @langchain/anthropic ChatAnthropic instance.
const claudeOpus = await initChatModel("anthropic:claude-3-opus-20240229", {
  temperature: 0,
});
// Returns a @langchain/google-vertexai ChatVertexAI instance.
const gemini15 = await initChatModel("google-vertexai:gemini-1.5-pro", {
  temperature: 0,
});

// Since all model integrations implement the ChatModel interface, you can use them in the same way.
console.log(`GPT-4o: ${(await gpt4o.invoke("what's your name")).content}\n`);
console.log(
  `Claude Opus: ${(await claudeOpus.invoke("what's your name")).content}\n`
);
console.log(
  `Gemini 1.5: ${(await gemini15.invoke("what's your name")).content}\n`
);

/*
GPT-4o: I'm an AI language model created by OpenAI, and I don't have a personal name. You can call me Assistant or any other name you prefer! How can I help you today?

Claude Opus: My name is Claude. It's nice to meet you!

Gemini 1.5: I don't have a name. I am a large language model, and I am not a person. I am a computer program that can generate text, translate languages, write different kinds of creative content, and answer your questions in an informative way.
*/
