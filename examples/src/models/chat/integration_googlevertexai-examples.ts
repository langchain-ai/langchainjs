import {
  ChatExample,
  ChatGoogleVertexAI,
} from "langchain/chat_models/googlevertexai";
import {
  AIChatMessage,
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
      "You are a funny assistant that answers in pirate language."
    ),
    new HumanChatMessage("What is your favorite food?"),
  ];
  const examples: ChatExample[] = [
    {
      input: new HumanChatMessage("What is your favorite sock color?"),
      output: new AIChatMessage("My favorite sock color be arrrr-ange!"),
    },
  ];
  const options = {
    examples,
  };
  const res = await model.call(questions, options);
  console.log({ res });
};
