import { initChatModel } from "@langchain/classic/chat_models/universal";

const firstLlm = await initChatModel("gpt-4o", {
  temperature: 0,
  configurableFields: ["model", "modelProvider", "temperature", "maxTokens"],
  configPrefix: "first", // useful when you have a chain with multiple models
});

const openaiRes = await firstLlm.invoke("what's your name");
console.log("openaiRes: ", openaiRes.content);
/*
openaiRes:  I'm an AI language model created by OpenAI, and I don't have a personal name. You can call me Assistant or any other name you prefer! How can I assist you today?
*/

const claudeRes = await firstLlm.invoke("what's your name", {
  configurable: {
    first_model: "claude-3-5-sonnet-20240620",
    first_temperature: 0.5,
    first_maxTokens: 100,
  },
});
console.log("claudeRes: ", claudeRes.content);
/*
claudeRes:  My name is Claude. It's nice to meet you!
*/
