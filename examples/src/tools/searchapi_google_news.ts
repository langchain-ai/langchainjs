import { SearchApi } from "langchain/tools";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { ChatPromptTemplate } from "langchain/prompts";
import { AgentExecutor } from "langchain/agents";
import { RunnableSequence } from "langchain/schema/runnable";
import { AgentFinish, AgentAction, BaseMessageChunk } from "langchain/schema";

const model = new ChatOpenAI({
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
