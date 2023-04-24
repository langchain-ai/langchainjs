import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage } from "langchain/schema";

export const run = async () => {
  const chat = new ChatOpenAI({
    maxTokens: 25,
    streaming: true,
    callbacks: [
      {
        handleLLMNewToken(token: string) {
          console.log({ token });
        },
      },
    ],
  });

  const response = await chat.call([new HumanChatMessage("Tell me a joke.")]);

  console.log(response);
  // { token: '' }
  // { token: '\n\n' }
  // { token: 'Why' }
  // { token: ' don' }
  // { token: "'t" }
  // { token: ' scientists' }
  // { token: ' trust' }
  // { token: ' atoms' }
  // { token: '?\n\n' }
  // { token: 'Because' }
  // { token: ' they' }
  // { token: ' make' }
  // { token: ' up' }
  // { token: ' everything' }
  // { token: '.' }
  // { token: '' }
  // AIChatMessage {
  //   text: "\n\nWhy don't scientists trust atoms?\n\nBecause they make up everything."
  // }
};
