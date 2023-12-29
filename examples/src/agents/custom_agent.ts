import { ChatOpenAI } from "@langchain/openai";
import { RunnableSequence } from "@langchain/core/runnables";
import { AgentExecutor, type AgentStep } from "langchain/agents";
import { formatToOpenAIFunctionMessages } from "langchain/agents/format_scratchpad";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { formatToOpenAIFunction, DynamicTool } from "langchain/tools";
import { OpenAIFunctionsAgentOutputParser } from "langchain/agents/openai/output_parser";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";

/**
 * Define your chat model to use.
 */
const model = new ChatOpenAI({ modelName: "gpt-3.5-turbo", temperature: 0 });

const customTool = new DynamicTool({
  name: "get_word_length",
  description: "Returns the length of a word.",
  func: async (input: string) => input.length.toString(),
});

/** Define your list of tools. */
const tools = [customTool];

/**
 * Define your prompt for the agent to follow
 * Here we're using `MessagesPlaceholder` to contain our agent scratchpad
 * This is important as later we'll use a util function which formats the agent
 * steps into a list of `BaseMessages` which can be passed into `MessagesPlaceholder`
 */
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are very powerful assistant, but don't know current events"],
  ["human", "{input}"],
  new MessagesPlaceholder("agent_scratchpad"),
]);

/**
 * Bind the tools to the LLM.
 * Here we're using the `formatToOpenAIFunction` util function
 * to format our tools into the proper schema for OpenAI functions.
 */
const modelWithFunctions = model.bind({
  functions: tools.map((tool) => formatToOpenAIFunction(tool)),
});

/**
 * Construct the runnable agent.
 *
 * We're using a `RunnableSequence` which takes two inputs:
 * - input --> the users input
 * - agent_scratchpad --> the previous agent steps
 *
 * We're using the `formatForOpenAIFunctions` util function to format the agent
 * steps into a list of `BaseMessages` which can be passed into `MessagesPlaceholder`
 */
const runnableAgent = RunnableSequence.from([
  {
    input: (i: { input: string; steps: AgentStep[] }) => i.input,
    agent_scratchpad: (i: { input: string; steps: AgentStep[] }) =>
      formatToOpenAIFunctionMessages(i.steps),
  },
  prompt,
  modelWithFunctions,
  new OpenAIFunctionsAgentOutputParser(),
]);
/** Pass the runnable along with the tools to create the Agent Executor */
const executor = AgentExecutor.fromAgentAndTools({
  agent: runnableAgent,
  tools,
});

console.log("Loaded agent executor");

const input = "How many letters in the word educa?";
console.log(`Calling agent executor with query: ${input}`);
const result = await executor.invoke({
  input,
});
console.log(result);
/*
  {
    input: 'How many letters in the word educa?',
    output: 'There are 5 letters in the word "educa".'
  }
*/

const MEMORY_KEY = "chat_history";
const memoryPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "You are very powerful assistant, but bad at calculating lengths of words.",
  ],
  new MessagesPlaceholder(MEMORY_KEY),
  ["user", "{input}"],
  new MessagesPlaceholder("agent_scratchpad"),
]);

const chatHistory: BaseMessage[] = [];

const agentWithMemory = RunnableSequence.from([
  {
    input: (i) => i.input,
    agent_scratchpad: (i) => formatToOpenAIFunctionMessages(i.steps),
    chat_history: (i) => i.chat_history,
  },
  memoryPrompt,
  modelWithFunctions,
  new OpenAIFunctionsAgentOutputParser(),
]);
/** Pass the runnable along with the tools to create the Agent Executor */
const executorWithMemory = AgentExecutor.fromAgentAndTools({
  agent: agentWithMemory,
  tools,
});

const input1 = "how many letters in the word educa?";
const result1 = await executorWithMemory.invoke({
  input: input1,
  chat_history: chatHistory,
});

console.log(result1);

chatHistory.push(new HumanMessage(input1));
chatHistory.push(new AIMessage(result.output));

const result2 = await executorWithMemory.invoke({
  input: "is that a real English word?",
  chat_history: chatHistory,
});

console.log(result2);
