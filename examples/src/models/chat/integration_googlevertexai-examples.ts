import { ChatGoogleVertexAI } from "langchain/chat_models/googlevertexai";
import {
  AIChatMessage,
  BaseChatMessage,
  HumanChatMessage,
  SystemChatMessage,
} from "langchain/schema";

export const run = async () => {
  const examples = [
    {
      input: new HumanChatMessage("What is your favorite sock color?"),
      output: new AIChatMessage("My favorite sock color be arrrr-ange!"),
    },
  ];
  const model = new ChatGoogleVertexAI({
    temperature: 0.7,
    examples,
  });
  const questions: BaseChatMessage[] = [
    new SystemChatMessage(
      "You are a funny assistant that answers in pirate language."
    ),
    new HumanChatMessage("What is your favorite food?"),
  ];
  const res = await model.call(questions);
  console.log({ res });
};
