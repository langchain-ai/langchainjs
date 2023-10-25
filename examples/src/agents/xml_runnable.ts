import { ChatAnthropic } from "langchain/chat_models/anthropic";
import { AgentExecutor } from "langchain/agents";
import { SerpAPI } from "langchain/tools";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
} from "langchain/prompts";
import { RunnableSequence } from "langchain/schema/runnable";
import { InputValues } from "langchain/schema";
import { XMLAgentOutputParser } from "langchain/agents/xml/output_parser";
import { renderTextDescriptionAndArgs } from "langchain/tools/render";
import { formatLogToMessage } from "langchain/agents/format_scratchpad/log_to_message";

/**
 * Define your chat model.
 * In this case we'll use Claude since it preforms well on XML related tasks
 */
const model = new ChatAnthropic({ modelName: "claude-2", temperature: 0.1 });
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
const createPrompt = () =>
  ChatPromptTemplate.fromMessages([
    HumanMessagePromptTemplate.fromTemplate(AGENT_INSTRUCTIONS),
    new MessagesPlaceholder("agent_scratchpad"),
  ]);
const prompt = createPrompt();

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
    input: (i: InputValues) => i.input,
    agent_scratchpad: (i: InputValues) => formatLogToMessage(i.steps),
    tools: () => renderTextDescriptionAndArgs(tools),
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
const result = await executor.call({ input });
console.log(result);

/*
Loaded agent.
Calling executor with input: What is the weather in Honolulu?
{
  output: '\n' +
    'The weather forecast for Honolulu today is a high of 84°F, a low of 73°F, sunny with a 16% chance of rain, winds ENE at 15 mph, humidity 66%, and a UV index of 8 out of 11.\n' +
    '</final_answer>'
}
*/
