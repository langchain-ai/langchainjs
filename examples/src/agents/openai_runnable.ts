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

/** Define your list of tools. */
const tools = [new Calculator(), new SerpAPI()];
/**
 * Define your chat model to use.
 * In this example we'll use gpt-4 as it is much better
 * at following directions in an agent than other models.
 */
const model = new ChatOpenAI({ modelName: "gpt-4", temperature: 0 });
/**
 * Define your prompt for the agent to follow
 * Here we're using `MessagesPlaceholder` to contain our agent scratchpad
 * This is important as later we'll use a util function which formats the agent
 * steps into a list of `BaseMessages` which can be passed into `MessagesPlaceholder`
 */
const prompt = ChatPromptTemplate.fromMessages([
  ["ai", "You are a helpful assistant"],
  ["human", "{input}"],
  new MessagesPlaceholder("agent_scratchpad"),
]);
/**
 * Bind the tools to the LLM.
 * Here we're using the `formatToOpenAIFunction` util function
 * to format our tools into the proper schema for OpenAI functions.
 */
const modelWithFunctions = model.bind({
  functions: [...tools.map((tool) => formatToOpenAIFunction(tool))],
});
/**
 * Define a new agent steps parser.
 */
const formatAgentSteps = (steps: AgentStep[]): BaseMessage[] =>
  steps.flatMap(({ action, observation }) => {
    if ("messageLog" in action && action.messageLog !== undefined) {
      const log = action.messageLog as BaseMessage[];
      return log.concat(new FunctionMessage(observation, action.tool));
    } else {
      return [new AIMessage(action.log)];
    }
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
      formatAgentSteps(i.steps),
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

const query = "What is the weather in New York?";
console.log(`Calling agent executor with query: ${query}`);
const result = await executor.invoke({
  input: query,
});
console.log(result);
/*
Loaded agent executor
Calling agent executor with query: What is the weather in New York?
{
  output: 'The current weather in New York is sunny with a temperature of 66 degrees Fahrenheit. The humidity is at 54% and the wind is blowing at 6 mph. There is 0% chance of precipitation.'
}
*/
