import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage } from "langchain/schema";

const chat = new ChatOpenAI({
  maxTokens: 25,
  streaming: true,
});

const response = await chat.call(
  [new HumanChatMessage("Tell me a joke.")],
  undefined,
  [
    {
      handleLLMNewToken(token: string) {
        console.log({ token });
      },
    },
  ]
);

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
