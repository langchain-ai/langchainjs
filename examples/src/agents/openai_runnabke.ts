import { AgentExecutor } from "langchain/agents";
import { formatForOpenAIFunctions } from "langchain/agents/format_scratchpad";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { ChatPromptTemplate, MessagesPlaceholder } from "langchain/prompts";
import { InputValues } from "langchain/schema";
import { RunnableSequence } from "langchain/schema/runnable";
import { SerpAPI, formatToOpenAIFunction } from "langchain/tools";
import { Calculator } from "langchain/tools/calculator";

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
  ["system", "You are a helpful assistant"],
  ["user", "{input}"],
  new MessagesPlaceholder("agent_scratchpad"),
]);
/**
 * Bind the tools to the LLM.
 * Here we're using the `formatToOpenAIFunction` util function
 * to format our tools into the proper schema for OpenAI functions.
 */
const modelWithTools = model.bind({
  functions: [...tools.map((tool) => formatToOpenAIFunction(tool))],
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
    input: (i: InputValues) => i.input,
    agent_scratchpad: (i: InputValues) => formatForOpenAIFunctions(i.steps),
  },
  prompt,
  modelWithTools,
  // new OpenAIFunctionsAgentOutputParser()
]);

const executor = AgentExecutor.fromAgentAndTools({
  agent: runnableAgent,
  tools,
});

const result = await executor.run("What is the weather in New York?");
console.log(result);

/*
  The current weather in New York is 72°F with a wind speed of 1 mph coming from the SSW. The humidity is at 89% and the UV index is 0 out of 11. The cloud cover is 79% and there has been no rain.
*/
