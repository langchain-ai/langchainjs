import { ChatAnthropic } from "langchain/chat_models/anthropic";
import { AgentExecutor } from "langchain/agents";
import { SerpAPI, Tool } from "langchain/tools";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
} from "langchain/prompts";
import { RunnableSequence } from "langchain/schema/runnable";
import { AgentStep } from "langchain/schema";
import { XMLAgentOutputParser } from "langchain/agents/xml/output_parser";
import { renderTextDescription } from "langchain/tools/render";
import { formatLogToMessage } from "langchain/agents/format_scratchpad/log_to_message";

/**
 * Define your chat model.
 * In this case we'll use Claude since it preforms well on XML related tasks
 */
const model = new ChatAnthropic({ modelName: "claude-2", temperature: 0 }).bind(
  {
    stop: ["</tool_input>", "</final_answer>"],
  }
);
/** Define your list of tools. */
const tools = [new SerpAPI()];

/**
 * Construct your prompt.
 * For XML not too much work is necessary, we just need to
 * define our prompt, and a messages placeholder for the
 * previous agent steps.
 */
const AGENT_INSTRUCTIONS = `You are a helpful assistant. Help the user answer any questions.

You have access to the following tools:

{tools}

In order to use a tool, you can use <tool></tool> and <tool_input></tool_input> tags.
You will then get back a response in the form <observation></observation>
For example, if you have a tool called 'search' that could run a google search, in order to search for the weather in SF you would respond:

<tool>search</tool><tool_input>weather in SF</tool_input>
<observation>64 degrees</observation>

When you are done, respond with a final answer between <final_answer></final_answer>. For example:

<final_answer>The weather in SF is 64 degrees</final_answer>

Begin!

Question: {input}`;
const prompt = ChatPromptTemplate.fromMessages([
  HumanMessagePromptTemplate.fromTemplate(AGENT_INSTRUCTIONS),
  new MessagesPlaceholder("agent_scratchpad"),
]);

/**
 * Next construct your runnable agent using a `RunnableSequence`
 * which takes in two arguments: input and agent_scratchpad.
 * The agent_scratchpad is then formatted using the `formatLogToMessage`
 * util because we're using a `MessagesPlaceholder` in our prompt.
 *
 * We also need to pass our tools through formatted as a string since
 * our prompt function does not format the prompt.
 */
const runnableAgent = RunnableSequence.from([
  {
    input: (i: { input: string; tools: Tool[]; steps: AgentStep[] }) => i.input,
    agent_scratchpad: (i: {
      input: string;
      tools: Tool[];
      steps: AgentStep[];
    }) => formatLogToMessage(i.steps),
    tools: (i: { input: string; tools: Tool[]; steps: AgentStep[] }) =>
      renderTextDescription(i.tools),
  },
  prompt,
  model,
  new XMLAgentOutputParser(),
]);

/**
 * Finally, we can define our agent executor and call it with an input.
 */
const executor = AgentExecutor.fromAgentAndTools({
  agent: runnableAgent,
  tools,
});

console.log("Loaded agent.");

const input = `What is the weather in Honolulu?`;
console.log(`Calling executor with input: ${input}`);
const result = await executor.invoke({ input, tools });
console.log(result);

/*
Loaded agent.
Calling executor with input: What is the weather in Honolulu?
{
  output: '\n' +
    'The weather in Honolulu is mostly sunny with a high of 72 degrees Fahrenheit, 2% chance of rain, 91% humidity, and winds around 2 mph.\n'
}
*/
