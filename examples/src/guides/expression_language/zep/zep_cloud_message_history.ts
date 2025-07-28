import { ZepClient } from "@getzep/zep-cloud";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { ConsoleCallbackHandler } from "@langchain/core/tracers/console";
import { ChatOpenAI } from "@langchain/openai";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { ZepCloudChatMessageHistory } from "@langchain/community/stores/message/zep_cloud";

// Your Zep Session ID.
const sessionId = "<Zep Session ID>";
const zepClient = new ZepClient({
  // Your Zep Cloud Project API key https://help.getzep.com/projects
  apiKey: "<Zep Api Key>",
});

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "Answer the user's question below. Be polite and helpful:"],
  new MessagesPlaceholder("history"),
  ["human", "{question}"],
]);

const chain = prompt
  .pipe(
    new ChatOpenAI({
      temperature: 0.8,
      model: "gpt-3.5-turbo-1106",
    })
  )
  .withConfig({
    callbacks: [new ConsoleCallbackHandler()],
  });

const chainWithHistory = new RunnableWithMessageHistory({
  runnable: chain,
  getMessageHistory: (sessionId) =>
    new ZepCloudChatMessageHistory({
      client: zepClient,
      sessionId,
      memoryType: "perpetual",
    }),
  inputMessagesKey: "question",
  historyMessagesKey: "history",
});

const result = await chainWithHistory.invoke(
  {
    question: "What did we talk about earlier?",
  },
  {
    configurable: {
      sessionId,
    },
  }
);

console.log("result", result);
