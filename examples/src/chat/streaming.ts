import { CallbackManager } from "langchain/callbacks";
import { ChatOpenAI } from "langchain/chat_models";
import { HumanChatMessage } from "langchain/schema";

export const run = async () => {
  const chat = new ChatOpenAI({
    streaming: true,
    callbackManager: CallbackManager.fromHandlers({
      async handleLLMNewToken(token) {
        console.log({ token });
      },
    }),
  });

  const response = await chat.call([
    new HumanChatMessage("Write me a song about sparkling water."),
  ]);

  console.log(response);
};
