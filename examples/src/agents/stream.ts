import { AgentExecutor, ZeroShotAgent } from "langchain/agents";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { ChatPromptTemplate } from "langchain/prompts";
import { RunnableSequence } from "langchain/runnables";
import { SerpAPI, Tool } from "langchain/tools";
import { WebBrowser } from "langchain/tools/webbrowser";

const model = new ChatOpenAI({
  temperature: 0,
  modelName: "gpt-4-1106-preview",
  streaming: true,
});
const tools = [
  new SerpAPI(process.env.SERPAPI_API_KEY, {
    location: "Austin,Texas,United States",
    hl: "en",
    gl: "us",
  }),
  new WebBrowser({ model, embeddings: new OpenAIEmbeddings() }),
];

const prompt = ChatPromptTemplate.fromMessages([
  [
    "ai",
    `Answer the following questions as best you can. You have access to the following tools:
{tools}

  Use the following format in your response:
  
  Question: the input question you must answer
  Thought: you should always think about what to do
  Action: the action to take, should be one of [{toolNames}]
  Action Input: the input to the action
  Observation: the result of the action
  ... (this Thought/Action/Action Input/Observation can repeat N times)
  Thought: I now know the final answer
  Final Answer: the final answer to the original input question
  
  Begin!
  
  Question: {question}
  Thought:`,
  ],
]);

const outputParser = ZeroShotAgent.getDefaultOutputParser();

const runnable = RunnableSequence.from([
  {
    toolNames: (i: { tools: Array<Tool>; question: string }) =>
      i.tools.map((t) => t.name).join(", "),
    tools: (i: { tools: Array<Tool>; question: string }) =>
      i.tools.map((t) => `${t.name}: ${t.description}`).join(", "),
    question: (i: { tools: Array<Tool>; question: string }) => i.question,
  },
  prompt,
  model,
  outputParser,
]);

const executor = AgentExecutor.fromAgentAndTools({
  agent: runnable,
  tools,
});

console.log("Loaded agent.");

const input = {
  question: `What is the word of the day on merriam webster`,
  tools,
};
console.log(`Executing with question "${input.question}"...`);

const result = await executor.stream(input);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let finalResponse: any;
for await (const item of result) {
  console.log("Stream item:", item);
  // each stream contains the previous steps,
  // so we can overwrite on each stream.
  finalResponse = item;
}
console.log("Final response:", finalResponse);
