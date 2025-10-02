import { initChatModel } from "@langchain/classic/chat_models/universal";

const gpt4o = await initChatModel("gpt-4o", {
  temperature: 0,
});
const claudeOpus = await initChatModel("claude-3-opus-20240229", {
  temperature: 0,
});
const gemini15 = await initChatModel("gemini-1.5-pro", {
  temperature: 0,
});
