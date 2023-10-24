import {
  ChatAgentOutputParser,
  initializeAgentExecutorWithOptions,
} from "langchain/agents";
import { OpenAI } from "langchain/llms/openai";
import { SerpAPI } from "langchain/tools";
import { Calculator } from "langchain/tools/calculator";

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
export const PREFIX = `Answer the following questions as best you can. You have access to the following tools:
{tools}`;
export const FORMAT_INSTRUCTIONS = `The way you use the tools is by specifying a json blob, denoted below by $JSON_BLOB
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
Final Answer: the final answer to the original input question`;
export const SUFFIX = `Begin! Reminder to always use the exact characters \`Final Answer\` when responding.`;
/**
 * Now we can combine all our prompts together, passing
 * in the required input variables.
 */
const createPrompt = () => {
  const toolStrings = formatTo
}

const executor = await initializeAgentExecutorWithOptions(tools, model, {
  agentType: "zero-shot-react-description",
  verbose: true,
});

const input = `Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?`;

const result = await executor.call({ input });
