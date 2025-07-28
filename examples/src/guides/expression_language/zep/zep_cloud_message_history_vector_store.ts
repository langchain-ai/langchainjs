import { ZepClient } from "@getzep/zep-cloud";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { ConsoleCallbackHandler } from "@langchain/core/tracers/console";
import { ChatOpenAI } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import {
  RunnableLambda,
  RunnableMap,
  RunnablePassthrough,
  RunnableWithMessageHistory,
} from "@langchain/core/runnables";
import { ZepCloudVectorStore } from "@langchain/community/vectorstores/zep_cloud";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ZepCloudChatMessageHistory } from "@langchain/community/stores/message/zep_cloud";

interface ChainInput {
  question: string;
  sessionId: string;
}

async function combineDocuments(docs: Document[], documentSeparator = "\n\n") {
  const docStrings: string[] = await Promise.all(
    docs.map((doc) => doc.pageContent)
  );
  return docStrings.join(documentSeparator);
}

// Your Zep Session ID.
const sessionId = "<Zep Session ID>";

const collectionName = "<Zep Collection Name>";

const zepClient = new ZepClient({
  // Your Zep Cloud Project API key https://help.getzep.com/projects
  apiKey: "<Zep Api Key>",
});

const vectorStore = await ZepCloudVectorStore.init({
  client: zepClient,
  collectionName,
});

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `Answer the question based only on the following context and conversation history: {context}`,
  ],
  new MessagesPlaceholder("history"),
  ["human", "{question}"],
]);

const model = new ChatOpenAI({
  temperature: 0.8,
  model: "gpt-3.5-turbo-1106",
});
const retriever = vectorStore.asRetriever();
const searchQuery = new RunnableLambda({
  func: async (input: any) => {
    // You can use zep to synthesize a question based on the user input and session context.
    // It can be useful because sometimes the user will type something like "yes" or "ok", which is not very useful for vector store retrieval.
    const { question } = await zepClient.memory.synthesizeQuestion(
      input.session_id
    );
    console.log("Synthesized question: ", question);
    return question;
  },
});
const retrieverLambda = new RunnableLambda({
  func: async (question: string) => {
    const response = await retriever.invoke(question);
    return combineDocuments(response);
  },
});
const setupAndRetrieval = RunnableMap.from({
  context: searchQuery.pipe(retrieverLambda),
  question: (x: any) => x.question,
  history: (x: any) => x.history,
});
const outputParser = new StringOutputParser();

const ragChain = setupAndRetrieval.pipe(prompt).pipe(model).pipe(outputParser);

const invokeChain = (chainInput: ChainInput) => {
  const chainWithHistory = new RunnableWithMessageHistory({
    runnable: RunnablePassthrough.assign({
      session_id: () => chainInput.sessionId,
    }).pipe(ragChain),
    getMessageHistory: (sessionId) =>
      new ZepCloudChatMessageHistory({
        client: zepClient,
        sessionId,
        memoryType: "perpetual",
      }),
    inputMessagesKey: "question",
    historyMessagesKey: "history",
  });

  return chainWithHistory.invoke(
    { question: chainInput.question },
    {
      configurable: {
        sessionId: chainInput.sessionId,
      },
    }
  );
};

const chain = new RunnableLambda({
  func: invokeChain,
}).withConfig({
  callbacks: [new ConsoleCallbackHandler()],
});

const result = await chain.invoke({
  question: "Project Gutenberg",
  sessionId,
});

console.log("result", result);
