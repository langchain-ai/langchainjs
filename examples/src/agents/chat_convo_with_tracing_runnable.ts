import { ChatOpenAI } from "langchain/chat_models/openai";
import { AgentExecutor } from "langchain/agents";
import { SerpAPI } from "langchain/tools";
import { Calculator } from "langchain/tools/calculator";
import { pull } from "langchain/hub";
import { PromptTemplate } from "langchain/prompts";
import { RunnableSequence } from "langchain/schema/runnable";
import { AgentStep, BaseMessage } from "langchain/schema";
import { BufferMemory } from "langchain/memory";
import { formatLogToString } from "langchain/agents/format_scratchpad/log";
import { renderTextDescription } from "langchain/tools/render";
import { ReActSingleInputOutputParser } from "langchain/agents/react/output_parser";

/** Define your chat model */
const model = new ChatOpenAI({ modelName: "gpt-4" });
/** Bind a stop token to the model */
const modelWithStop = model.bind({
  stop: ["\nObservation"],
});
/** Define your list of tools */
const tools = [
  new SerpAPI(process.env.SERPAPI_API_KEY, {
    location: "Austin,Texas,United States",
    hl: "en",
    gl: "us",
  }),
  new Calculator(),
];
/**
 * Pull a prompt from LangChain Hub
 * @link https://smith.langchain.com/hub/hwchase17/react-chat
 */
const prompt = await pull<PromptTemplate>("hwchase17/react-chat");
/** Add input variables to prompt */
const toolNames = tools.map((tool) => tool.name);
const promptWithInputs = await prompt.partial({
  tools: renderTextDescription(tools),
  tool_names: toolNames.join(","),
});

const runnableAgent = RunnableSequence.from([
  {
    input: (i: {
      input: string;
      steps: AgentStep[];
      chat_history: BaseMessage[];
    }) => i.input,
    agent_scratchpad: (i: {
      input: string;
      steps: AgentStep[];
      chat_history: BaseMessage[];
    }) => formatLogToString(i.steps),
    chat_history: (i: {
      input: string;
      steps: AgentStep[];
      chat_history: BaseMessage[];
    }) => i.chat_history,
  },
  promptWithInputs,
  modelWithStop,
  new ReActSingleInputOutputParser({ toolNames }),
]);
/**
 * Define your memory store
 * @important The memoryKey must be "chat_history" for the chat agent to work
 * because this is the key this particular prompt expects.
 */
const memory = new BufferMemory({ memoryKey: "chat_history" });
/** Define your executor and pass in the agent, tools and memory */
const executor = AgentExecutor.fromAgentAndTools({
  agent: runnableAgent,
  tools,
  memory,
});

console.log("Loaded agent.");

const input0 = "hi, i am bob";
const result0 = await executor.invoke({ input: input0 });
console.log(`Got output ${result0.output}`);

const input1 = "whats my name?";
const result1 = await executor.invoke({ input: input1 });
console.log(`Got output ${result1.output}`);

const input2 = "whats the weather in pomfret?";
const result2 = await executor.invoke({ input: input2 });
console.log(`Got output ${result2.output}`);
/**
 * Loaded agent.
 * Got output Hello Bob, how can I assist you today?
 * Got output Your name is Bob.
 * Got output The current weather in Pomfret, CT is partly cloudy with a temperature of 59 degrees Fahrenheit. The humidity is at 52% and there is a wind speed of 8 mph. There is a 0% chance of precipitation.
 */
