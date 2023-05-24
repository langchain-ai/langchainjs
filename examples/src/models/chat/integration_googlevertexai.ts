import { ChatGoogleVertexAI } from "langchain/chat_models/googlevertexai";
import {
  BaseChatMessage,
  HumanChatMessage,
  SystemChatMessage,
} from "langchain/schema";

export const run = async () => {
  const model = new ChatGoogleVertexAI({
    temperature: 0.7,
  });
  const questions: BaseChatMessage[] = [
    new SystemChatMessage(
      "You are a helpful assistant that answers in pirate language."
    ),
    new HumanChatMessage(
      "What would be a good name for a company that makes colorful socks?"
    ),
  ];
  const res = await model.call(questions);
  console.log({ res });
};
