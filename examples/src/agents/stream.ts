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

// Initialize the LLM chat model to use in the agent.
const model = new ChatOpenAI({
  temperature: 0,
  modelName: "gpt-4-1106-preview",
});
// Define the tools the agent will have access to.
const tools = [
  new WebBrowser({ model, embeddings: new OpenAIEmbeddings() }),
  new Calculator(),
];
// Craft your agent's prompt. It's important to include the following parts:
// 1. tools -> This is the name and description of each tool the agent has access to.
//    Remember to separate each tool with a new line.
//
// 2. toolNames -> Reiterate the names of the tools in the middle of the prompt
//    after explaining how to format steps, etc.
//
// 3. intermediateSteps -> This is the history of the agent's thought process.
//    This is very important because without this the agent will have zero context
//    on past actions and observations.
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

History:
{intermediateSteps}

Question: {question}
Thought:`,
  ],
]);

// Initialize the memory buffer. This is where our past steps will be stored.
const memory = new BufferMemory({});
// Use the default output parser for the agent. This is a class which parses
// the string responses from the LLM into AgentStep's or AgentFinish.
const outputParser = ZeroShotAgent.getDefaultOutputParser();
// The initial input which we'll pass to the agent. Note the inclusion
// of the tools array we defined above.
const input = {
  question: `What is the word of the day on merriam webster`,
  tools,
};
// Create the runnable which will be responsible for executing agent steps.
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
// Initialize the AgentExecutor with the runnable defined above, and the
// tools array.
const executor = AgentExecutor.fromAgentAndTools({
  agent: runnable,
  tools,
});
// Define a custom function which will format the agent steps to a string,
// then save to memory.
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

// Call `.stream()` with the inputs on the executor, then
// iterate over the steam and save each stream step to memory.
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
