import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import Exa from "exa-js";
import { createAgent } from "langchain";
import { createRetrieverTool } from "langchain/tools/retriever";
import { ExaRetriever } from "@langchain/exa";
import { HumanMessage } from "@langchain/core/messages";

// @ts-expect-error Some TS Config's will cause this to give a TypeScript error, even though it works.
const client: Exa.default = new Exa(process.env.EXASEARCH_API_KEY);

const exaRetriever = new ExaRetriever({
  client,
  searchArgs: {
    numResults: 2,
  },
});

// Convert the ExaRetriever into a tool
const searchTool = createRetrieverTool(exaRetriever, {
  name: "search",
  description: "Get the contents of a webpage given a string search query.",
});

const tools = [searchTool];
const llm = new ChatOpenAI({ model: "gpt-4", temperature: 0 });
const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a web researcher who answers user questions by looking up information on the internet and retrieving contents of helpful documents. Cite your sources.`,
  ],
  ["human", "{input}"],
  new MessagesPlaceholder("agent_scratchpad"),
]);
const agent = await createAgent({
  llm,
  tools,
  prompt,
});

console.log(
  await agent.invoke({
    messages: ["Summarize for me a fascinating article about cats."],
  })
);
