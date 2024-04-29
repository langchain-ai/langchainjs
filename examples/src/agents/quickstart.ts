import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

import { pull } from "langchain/hub";
import type { ChatPromptTemplate } from "@langchain/core/prompts";
import { createRetrieverTool } from "langchain/tools/retriever";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { CheerioWebBaseLoader } from "langchain/document_loaders/web/cheerio";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { ChatMessageHistory } from "@langchain/community/stores/message/in_memory";

const searchTool = new TavilySearchResults();

const toolResult = await searchTool.invoke("what is the weather in SF?");

console.log(toolResult);

/*
  [{"title":"Weather in December 2023 in San Francisco, California, USA","url":"https://www.timeanddate.com/weather/@5391959/historic?month=12&year=2023","content":"Currently: 52 °F. Broken clouds. (Weather station: San Francisco International Airport, USA). See more current weather Select month: December 2023 Weather in San Francisco — Graph °F Sun, Dec 17 Lo:55 6 pm Hi:57 4 Mon, Dec 18 Lo:54 12 am Hi:55 7 Lo:54 6 am Hi:55 10 Lo:57 12 pm Hi:64 9 Lo:63 6 pm Hi:64 14 Tue, Dec 19 Lo:61","score":0.96006},...]
*/

const loader = new CheerioWebBaseLoader(
  "https://docs.smith.langchain.com/user_guide"
);
const rawDocs = await loader.load();
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});
const docs = await splitter.splitDocuments(rawDocs);
const vectorstore = await MemoryVectorStore.fromDocuments(
  docs,
  new OpenAIEmbeddings()
);
const retriever = vectorstore.asRetriever();

const retrieverResult = await retriever.invoke("how to upload a dataset");
console.log(retrieverResult[0]);

/*
  Document {
    pageContent: "your application progresses through the beta testing phase, it's essential to continue collecting data to refine and improve...",
    metadata: {
      source: 'https://docs.smith.langchain.com/user_guide',
      loc: { lines: [Object] }
    }
  }
*/

const retrieverTool = createRetrieverTool(retriever, {
  name: "langsmith_search",
  description:
    "Search for information about LangSmith. For any questions about LangSmith, you must use this tool!",
});

const tools = [searchTool, retrieverTool];

const llm = new ChatOpenAI({
  model: "gpt-3.5-turbo-1106",
  temperature: 0,
});

// Get the prompt to use - you can modify this!
// If you want to see the prompt in full, you can at:
// https://smith.langchain.com/hub/hwchase17/openai-functions-agent
const prompt = await pull<ChatPromptTemplate>(
  "hwchase17/openai-functions-agent"
);

const agent = await createOpenAIFunctionsAgent({
  llm,
  tools,
  prompt,
});

const agentExecutor = new AgentExecutor({
  agent,
  tools,
  verbose: true,
});

const result1 = await agentExecutor.invoke({
  input: "hi!",
});

console.log(result1);

const result2 = await agentExecutor.invoke({
  input: "how can langsmith help with testing?",
});

console.log(result2);

const result3 = await agentExecutor.invoke({
  input: "hi! my name is cob.",
  chat_history: [],
});

console.log(result3);

const result4 = await agentExecutor.invoke({
  input: "what's my name?",
  chat_history: [
    new HumanMessage("hi! my name is cob."),
    new AIMessage("Hello Cob! How can I assist you today?"),
  ],
});

console.log(result4);

const messageHistory = new ChatMessageHistory();

const agentWithChatHistory = new RunnableWithMessageHistory({
  runnable: agentExecutor,
  // This is needed because in most real world scenarios, a session id is needed per user.
  // It isn't really used here because we are using a simple in memory ChatMessageHistory.
  getMessageHistory: (_sessionId) => messageHistory,
  inputMessagesKey: "input",
  historyMessagesKey: "chat_history",
});

const result5 = await agentWithChatHistory.invoke(
  {
    input: "hi! i'm cob",
  },
  {
    // This is needed because in most real world scenarios, a session id is needed per user.
    // It isn't really used here because we are using a simple in memory ChatMessageHistory.
    configurable: {
      sessionId: "foo",
    },
  }
);

console.log(result5);

const result6 = await agentWithChatHistory.invoke(
  {
    input: "what's my name?",
  },
  {
    // This is needed because in most real world scenarios, a session id is needed per user.
    // It isn't really used here because we are using a simple in memory ChatMessageHistory.
    configurable: {
      sessionId: "foo",
    },
  }
);

console.log(result6);
