/* eslint-disable import/first */
import { CheerioWebBaseLoader } from "langchain/document_loaders/web/cheerio";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";

const chatModel = new ChatOpenAI({});

const embeddings = new OpenAIEmbeddings({});

const loader = new CheerioWebBaseLoader(
  "https://docs.smith.langchain.com/overview"
);

const docs = await loader.load();

console.log(docs.length);
console.log(docs[0].pageContent.length);

import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

const splitter = new RecursiveCharacterTextSplitter();

const splitDocs = await splitter.splitDocuments(docs);

console.log(splitDocs.length);
console.log(splitDocs[0].pageContent.length);

import { MemoryVectorStore } from "langchain/vectorstores/memory";

const vectorstore = await MemoryVectorStore.fromDocuments(
  splitDocs,
  embeddings
);

import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";

const prompt =
  ChatPromptTemplate.fromTemplate(`Answer the following question based only on the provided context:

<context>
{context}
</context>

Question: {input}`);

const documentChain = await createStuffDocumentsChain({
  llm: chatModel,
  prompt,
});

import { Document } from "@langchain/core/documents";

console.log(
  await documentChain.invoke({
    input: "what is LangSmith?",
    context: [
      new Document({
        pageContent:
          "LangSmith is a platform for building production-grade LLM applications.",
      }),
    ],
  })
);

const retriever = vectorstore.asRetriever();

import { createRetrieverTool } from "langchain/tools/retriever";

const retrieverTool = await createRetrieverTool(retriever, {
  name: "langsmith_search",
  description:
    "Search for information about LangSmith. For any questions about LangSmith, you must use this tool!",
});

import { TavilySearchResults } from "@langchain/community/tools/tavily_search";

const searchTool = new TavilySearchResults();

const tools = [retrieverTool, searchTool];

import { pull } from "langchain/hub";
import { createOpenAIFunctionsAgent, AgentExecutor } from "langchain/agents";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

// Get the prompt to use - you can modify this!
// If you want to see the prompt in full, you can at:
// https://smith.langchain.com/hub/hwchase17/openai-functions-agent
const agentPrompt = await pull<ChatPromptTemplate>(
  "hwchase17/openai-functions-agent"
);

const agentModel = new ChatOpenAI({
  modelName: "gpt-3.5-turbo-1106",
  temperature: 0,
});

const agent = await createOpenAIFunctionsAgent({
  llm: agentModel,
  tools,
  prompt: agentPrompt,
});

const agentExecutor = new AgentExecutor({
  agent,
  tools,
  verbose: true,
});

const agentResult = await agentExecutor.invoke({
  input: "how can LangSmith help with testing?",
});

console.log(agentResult);

const agentResult2 = await agentExecutor.invoke({
  input: "what is the weather in SF?",
});

console.log(agentResult2);

const agentResult3 = await agentExecutor.invoke({
  chat_history: [
    new HumanMessage("Can LangSmith help test my LLM applications?"),
    new AIMessage("Yes!"),
  ],
  input: "Tell me how",
});

console.log(agentResult3);
