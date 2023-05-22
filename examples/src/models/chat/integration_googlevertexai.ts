import { ChatGoogleVertexAi } from "langchain/chat_models/googlevertexai";
import { HumanChatMessage } from "langchain/schema";

export const run = async () => {
  const model = new ChatGoogleVertexAi({
    temperature: 0.7,
    context: "You are a helpful assistant that answers in pirate language.",
  });
  const question = new HumanChatMessage(
    "Question: What would be a good company name a company that makes colorful socks?\nAnswer:"
  );
  const res = await model.call([question]);
  console.log({ res });
};
