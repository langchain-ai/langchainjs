import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";

const chat = new ChatOpenAI({
  model: "gpt-4o-mini",
  maxTokens: 25,
  streaming: true,
});

const response = await chat.invoke([new HumanMessage("Tell me a joke.")], {
  callbacks: [
    {
      handleLLMNewToken(token: string) {
        console.log({ token });
      },
    },
  ],
});

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
// AIMessage {
//   text: "\n\nWhy don't scientists trust atoms?\n\nBecause they make up everything."
// }
