import { initChatModel } from "langchain/chat_models/universal";

const configurableModel = await initChatModel(undefined, { temperature: 0 });

const gpt4Res = await configurableModel.invoke("what's your name", {
  configurable: { model: "gpt-4o-mini" },
});
console.log("gpt4Res: ", gpt4Res.content);
/*
gpt4Res:  I'm an AI language model created by OpenAI, and I don't have a personal name. You can call me Assistant or any other name you prefer! How can I assist you today?
*/

const claudeRes = await configurableModel.invoke("what's your name", {
  configurable: { model: "claude-3-5-sonnet-20240620" },
});
console.log("claudeRes: ", claudeRes.content);
/*
claudeRes:  My name is Claude. It's nice to meet you!
*/
