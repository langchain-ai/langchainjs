import { ChatAnthropic } from "langchain/chat_models/anthropic";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { SerpAPI } from "langchain/tools";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
} from "langchain/prompts";

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

const executor = await initializeAgentExecutorWithOptions(tools, model, {
  agentType: "xml",
  verbose: true,
});
console.log("Loaded agent.");

const input = `What is the weather in Honolulu?`;

const result = await executor.call({ input });

console.log(result);

/*
  https://smith.langchain.com/public/d0acd50a-f99d-4af0-ae66-9009de319fb5/r
  {
    output: 'The weather in Honolulu is currently 75 degrees Fahrenheit with a small craft advisory in effect. The forecast calls for generally clear skies tonight with a low of 75 degrees.'
  }
*/
