import { AgentExecutor, ZeroShotAgent } from "langchain/agents";
import { formatLogToString } from "langchain/agents/format_scratchpad/log";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { BufferMemory } from "langchain/memory";
import { ChatPromptTemplate } from "langchain/prompts";
import { RunnableSequence } from "langchain/runnables";
import { Tool } from "langchain/tools";
import { Calculator } from "langchain/tools/calculator";
import { WebBrowser } from "langchain/tools/webbrowser";

const model = new ChatOpenAI({
  temperature: 0,
  modelName: "gpt-4-1106-preview",
});
const tools = [
  new WebBrowser({ model, embeddings: new OpenAIEmbeddings() }),
  new Calculator(),
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

History:
{intermediateSteps}

Begin!

Question: {question}
Thought:`,
  ],
]);

const memory = new BufferMemory({});

const outputParser = ZeroShotAgent.getDefaultOutputParser();

const input = {
  question: `What is the word of the day on merriam webster`,
  tools,
};

const runnable = RunnableSequence.from([
  {
    toolNames: (i: { tools: Array<Tool>; question: string }) =>
      i.tools.map((t) => t.name).join(", "),
    tools: (i: { tools: Array<Tool>; question: string }) =>
      i.tools.map((t) => `${t.name}: ${t.description}`).join("\n"),
    question: (i: { tools: Array<Tool>; question: string }) => i.question,
    intermediateSteps: async (_: { tools: Array<Tool>; question: string }) => {
      const { history } = await memory.loadMemoryVariables({});
      return history.replaceAll("Human: none", "");
    },
  },
  prompt,
  model,
  outputParser,
]);

const executor = AgentExecutor.fromAgentAndTools({
  agent: runnable,
  tools,
});

const saveMemory = async (output: any) => {
  if (!("intermediateSteps" in output)) return;
  const { intermediateSteps } = output;
  await memory.saveContext(
    { human: "none" },
    {
      history: formatLogToString(intermediateSteps),
    }
  );
};

console.log("Loaded agent.");

console.log(`Executing with question "${input.question}"...`);

const result = await executor.stream(input);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const finalResponse: Array<any> = [];
for await (const item of result) {
  console.log("Stream item:", {
    ...item,
  });
  await saveMemory(item);
  finalResponse.push(item);
}
console.log("Final response:", finalResponse);

/**
 * See the LangSmith trace for this agent example here:
 * @link https://smith.langchain.com/public/08978fa7-bb99-427b-850e-35773cae1453/r
 */
