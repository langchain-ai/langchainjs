import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { AgentFinish, AgentAction } from "@langchain/core/agents";
import { BaseMessageChunk } from "@langchain/core/messages";
import { SearchApi } from "@langchain/community/tools/searchapi";

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
});
const tools = [
  new SearchApi(process.env.SEARCHAPI_API_KEY, {
    engine: "google_news",
  }),
];
const prefix = ChatPromptTemplate.fromMessages([
  [
    "ai",
    "Answer the following questions as best you can. In your final answer, use a bulleted list markdown format.",
  ],
  ["human", "{input}"],
]);
// Replace this with your actual output parser.
const customOutputParser = (
  input: BaseMessageChunk
): AgentAction | AgentFinish => ({
  log: "test",
  returnValues: {
    output: input,
  },
});
// Replace this placeholder agent with your actual implementation.
const agent = RunnableSequence.from([prefix, model, customOutputParser]);
const executor = AgentExecutor.fromAgentAndTools({
  agent,
  tools,
});
const res = await executor.invoke({
  input: "What's happening in Ukraine today?",
});
console.log(res);
