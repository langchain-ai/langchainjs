import { AgentExecutor, ChatAgentOutputParser } from "langchain/agents";
import { formatLogToString } from "langchain/agents/format_scratchpad/log";
import { OpenAI } from "langchain/llms/openai";
import { ChatPromptTemplate, PromptTemplate } from "langchain/prompts";
import { AgentStep } from "langchain/schema";
import { RunnableSequence } from "langchain/schema/runnable";
import { SerpAPI } from "langchain/tools";
import { Calculator } from "langchain/tools/calculator";
import { renderTextDescription } from "langchain/tools/render";

/** Define the model to be used */
const model = new OpenAI({ temperature: 0 });

/** Create a list of the tools we're providing to the agent */
const tools = [
  new SerpAPI(process.env.SERPAPI_API_KEY, {
    location: "Austin,Texas,United States",
    hl: "en",
    gl: "us",
  }),
  new Calculator(),
];

/**
 * Define our output parser.
 * In this case we'll use the default output parser
 * for chat agents. `ChatAgentOutputParser`
 */
const outputParser = new ChatAgentOutputParser();

/**
 * Define our prompts.
 * For this example we'll use the same default prompts
 * that the `ChatAgent` class uses.
 */
const PREFIX = `Answer the following questions as best you can. You have access to the following tools:
{tools}`;
const FORMAT_INSTRUCTIONS = `The way you use the tools is by specifying a json blob, denoted below by $JSON_BLOB
Specifically, this $JSON_BLOB should have a "action" key (with the name of the tool to use) and a "action_input" key (with the input to the tool going here). 
The $JSON_BLOB should only contain a SINGLE action, do NOT return a list of multiple actions. Here is an example of a valid $JSON_BLOB:

\`\`\`
{{
  "action": "calculator",
  "action_input": "1 + 2"
}}
\`\`\`

ALWAYS use the following format:

Question: the input question you must answer
Thought: you should always think about what to do
Action: 
\`\`\`
$JSON_BLOB
\`\`\`
Observation: the result of the action
... (this Thought/Action/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question

Action part must be always wrapped in 3 backticks.`;
const SUFFIX = `Begin! Reminder to always use the exact characters \`Final Answer\` when responding.
Thoughts: {agent_scratchpad}`;
const DEFAULT_HUMAN_MESSAGE_TEMPLATE = "Question: {input}";
/**
 * Now we can combine all our prompts together, passing
 * in the required input variables.
 */
// The `renderTextDescription` util function combines
// all tool names and descriptions into a single string.
const toolStrings = renderTextDescription(tools);
const prefixTemplate = PromptTemplate.fromTemplate(PREFIX);
const formattedPrefix = await prefixTemplate.format({ tools: toolStrings });
const template = [formattedPrefix, FORMAT_INSTRUCTIONS, SUFFIX].join("\n\n");
// Add the template, and human message template to an array of messages.
const prompt = ChatPromptTemplate.fromMessages([
  ["ai", template],
  ["human", DEFAULT_HUMAN_MESSAGE_TEMPLATE],
]);

/**
 * Combine all our previous steps into a runnable agent.
 * We'll use a `RunnableSequence` which takes in an input,
 * and the previous steps. We then format the steps into a
 * string so it can be passed to the prompt.
 */
const runnableAgent = RunnableSequence.from([
  {
    input: (i: { input: string; steps: AgentStep[] }) => i.input,
    agent_scratchpad: (i: { input: string; steps: AgentStep[] }) =>
      formatLogToString(i.steps),
  },
  prompt,
  // Important, otherwise the answer is only hallucinated
  model.bind({ stop: ["\nObservation"] }),
  outputParser,
]);

/**
 * The last step is to pass our agent into the
 * AgentExecutor along with the tools.
 * The AgentExecutor is responsible for actually
 * running the iterations.
 */
const executor = AgentExecutor.fromAgentAndTools({
  agent: runnableAgent,
  tools,
});

console.log("Loaded agent executor");

const input = `Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?`;
console.log(`Calling agent with prompt: ${input}`);
const result = await executor.invoke({ input });
console.log(result);
/**
Loaded agent executor
Calling agent with prompt: Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?
{
  output: "Jason Sudeikis is Olivia Wilde's boyfriend and his current age raised to the 0.23 power is approximately 1.7."
}
 */
