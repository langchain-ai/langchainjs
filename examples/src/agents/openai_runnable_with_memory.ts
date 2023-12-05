import { AgentExecutor } from "langchain/agents";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { ChatPromptTemplate, MessagesPlaceholder } from "langchain/prompts";
import {
  AIMessage,
  AgentStep,
  BaseMessage,
  FunctionMessage,
} from "langchain/schema";
import { RunnableSequence } from "langchain/schema/runnable";
import { SerpAPI, formatToOpenAIFunction } from "langchain/tools";
import { Calculator } from "langchain/tools/calculator";
import { OpenAIFunctionsAgentOutputParser } from "langchain/agents/openai/output_parser";
import { BufferMemory } from "langchain/memory";

/** Define your list of tools. */
const tools = [new Calculator(), new SerpAPI()];
/**
 * Define your chat model to use.
 * In this example we'll use gpt-4 as it is much better
 * at following directions in an agent than other models.
 */
const model = new ChatOpenAI({ modelName: "gpt-4", temperature: 0 });

/**
 * Bind the tools to the LLM.
 * Here we're using the `formatToOpenAIFunction` util function
 * to format our tools into the proper schema for OpenAI functions.
 */
const modelWithFunctions = model.bind({
  functions: [...tools.map((tool) => formatToOpenAIFunction(tool))],
});

const memory = new BufferMemory({
  memoryKey: "history", // The object key to store the memory under
  inputKey: "question", // The object key for the input
  outputKey: "answer", // The object key for the output
  returnMessages: true,
});

const prompt = ChatPromptTemplate.fromMessages([
  ["ai", "You are a helpful assistant."],
  new MessagesPlaceholder("chat_history"),
  ["human", "{input}"],
  new MessagesPlaceholder("agent_scratchpad"),
]);

const formatAgentSteps = (steps: AgentStep[]): BaseMessage[] =>
  steps.flatMap(({ action, observation }) => {
    if ("messageLog" in action && action.messageLog !== undefined) {
      const log = action.messageLog as BaseMessage[];
      return log.concat(new FunctionMessage(observation, action.tool));
    } else {
      return [new AIMessage(action.log)];
    }
  });

const runnableAgent = RunnableSequence.from([
  {
    input: (i: { input: string; steps: AgentStep[] }) => i.input,
    agent_scratchpad: (i: { input: string; steps: AgentStep[] }) =>
      formatAgentSteps(i.steps),
    // Load memory here
    chat_history: async (_: { input: string; steps: AgentStep[] }) => {
      const { history } = await memory.loadMemoryVariables({});
      return history;
    },
  },
  prompt,
  modelWithFunctions,
  new OpenAIFunctionsAgentOutputParser(),
]);

const executor = AgentExecutor.fromAgentAndTools({
  agent: runnableAgent,
  tools,
});

const query = "What is the weather in New York?";
console.log(`Calling agent executor with query: ${query}`);
const result = await executor.invoke({
  input: query,
});
console.log(result);
/*
Calling agent executor with query: What is the weather in New York?
{
  output: 'The current weather in New York is sunny with a temperature of 66 degrees Fahrenheit. The humidity is at 54% and the wind is blowing at 6 mph. There is 0% chance of precipitation.'
}
*/

// Save the result and initial input to memory
await memory.saveContext(
  {
    question: query,
  },
  {
    answer: result.output,
  }
);

const query2 = "Do I need a jacket?";
const result2 = await executor.invoke({
  input: query2,
});
console.log(result2);
/*
{
  output: 'Based on the current weather in New York, you may not need a jacket. However, if you feel cold easily or will be outside for a long time, you might want to bring a light jacket just in case.'
}
 */
