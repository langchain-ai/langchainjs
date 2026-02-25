import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { Seltz } from "seltz";
import {
  AgentExecutor,
  createOpenAIToolsAgent,
} from "@langchain/classic/agents";
import { createRetrieverTool } from "@langchain/classic/tools/retriever";
import { SeltzRetriever } from "@langchain/seltz";

const client = new Seltz({ apiKey: process.env.SELTZ_API_KEY });

const seltzRetriever = new SeltzRetriever({
  client,
  searchArgs: {
    maxDocuments: 5,
  },
});

// Convert the SeltzRetriever into a tool
const searchTool = createRetrieverTool(seltzRetriever, {
  name: "search",
  description: "Get the contents of a webpage given a string search query.",
});

const tools = [searchTool];
const llm = new ChatOpenAI({ model: "gpt-4o", temperature: 0 });
const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a web researcher who answers user questions by looking up information on the internet and retrieving contents of helpful documents. Cite your sources.`,
  ],
  ["human", "{input}"],
  new MessagesPlaceholder("agent_scratchpad"),
]);
const agentExecutor = new AgentExecutor({
  agent: await createOpenAIToolsAgent({
    llm,
    tools,
    prompt,
  }),
  tools,
});
console.log(
  await agentExecutor.invoke({
    input: "Summarize for me a fascinating article about cats.",
  })
);
