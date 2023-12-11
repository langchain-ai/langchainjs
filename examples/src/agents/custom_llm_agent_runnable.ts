import { AgentExecutor } from "langchain/agents";
import { formatLogToString } from "langchain/agents/format_scratchpad/log";
import { OpenAI } from "langchain/llms/openai";
import { PromptTemplate } from "langchain/prompts";
import {
  AgentAction,
  AgentFinish,
  AgentStep,
  BaseMessage,
  HumanMessage,
  InputValues,
} from "langchain/schema";
import { RunnableSequence } from "langchain/schema/runnable";
import { SerpAPI } from "langchain/tools";
import { Calculator } from "langchain/tools/calculator";

/**
 * Instantiate the LLM and bind the stop token
 * @important The stop token must be set, if not the LLM will happily continue generating text forever.
 */
const model = new OpenAI({ temperature: 0 }).bind({
  stop: ["\nObservation"],
});
/** Define the tools */
const tools = [
  new SerpAPI(process.env.SERPAPI_API_KEY, {
    location: "Austin,Texas,United States",
    hl: "en",
    gl: "us",
  }),
  new Calculator(),
];
/** Create the prefix prompt */
const PREFIX = `Answer the following questions as best you can. You have access to the following tools:
{tools}`;
/** Create the tool instructions prompt */
const TOOL_INSTRUCTIONS_TEMPLATE = `Use the following format in your response:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question`;
/** Create the suffix prompt */
const SUFFIX = `Begin!

Question: {input}
Thought:`;

async function formatMessages(
  values: InputValues
): Promise<Array<BaseMessage>> {
  /** Check input and intermediate steps are both inside values */
  if (!("input" in values) || !("intermediate_steps" in values)) {
    throw new Error("Missing input or agent_scratchpad from values.");
  }
  /** Extract and case the intermediateSteps from values as Array<AgentStep> or an empty array if none are passed */
  const intermediateSteps = values.intermediate_steps
    ? (values.intermediate_steps as Array<AgentStep>)
    : [];
  /** Call the helper `formatLogToString` which returns the steps as a string  */
  const agentScratchpad = formatLogToString(intermediateSteps);
  /** Construct the tool strings */
  const toolStrings = tools
    .map((tool) => `${tool.name}: ${tool.description}`)
    .join("\n");
  const toolNames = tools.map((tool) => tool.name).join(",\n");
  /** Create templates and format the instructions and suffix prompts */
  const prefixTemplate = new PromptTemplate({
    template: PREFIX,
    inputVariables: ["tools"],
  });
  const instructionsTemplate = new PromptTemplate({
    template: TOOL_INSTRUCTIONS_TEMPLATE,
    inputVariables: ["tool_names"],
  });
  const suffixTemplate = new PromptTemplate({
    template: SUFFIX,
    inputVariables: ["input"],
  });
  /** Format both templates by passing in the input variables */
  const formattedPrefix = await prefixTemplate.format({
    tools: toolStrings,
  });
  const formattedInstructions = await instructionsTemplate.format({
    tool_names: toolNames,
  });
  const formattedSuffix = await suffixTemplate.format({
    input: values.input,
  });
  /** Construct the final prompt string */
  const formatted = [
    formattedPrefix,
    formattedInstructions,
    formattedSuffix,
    agentScratchpad,
  ].join("\n");
  /** Return the message as a HumanMessage. */
  return [new HumanMessage(formatted)];
}

/** Define the custom output parser */
function customOutputParser(text: string): AgentAction | AgentFinish {
  /** If the input includes "Final Answer" return as an instance of `AgentFinish` */
  if (text.includes("Final Answer:")) {
    const parts = text.split("Final Answer:");
    const input = parts[parts.length - 1].trim();
    const finalAnswers = { output: input };
    return { log: text, returnValues: finalAnswers };
  }
  /** Use regex to extract any actions and their values */
  const match = /Action: (.*)\nAction Input: (.*)/s.exec(text);
  if (!match) {
    throw new Error(`Could not parse LLM output: ${text}`);
  }
  /** Return as an instance of `AgentAction` */
  return {
    tool: match[1].trim(),
    toolInput: match[2].trim().replace(/^"+|"+$/g, ""),
    log: text,
  };
}

/** Define the Runnable with LCEL */
const runnable = RunnableSequence.from([
  {
    input: (values: InputValues) => values.input,
    intermediate_steps: (values: InputValues) => values.steps,
  },
  formatMessages,
  model,
  customOutputParser,
]);
/** Pass the runnable to the `AgentExecutor` class as the agent */
const executor = new AgentExecutor({
  agent: runnable,
  tools,
});
console.log("Loaded agent.");

const input = `Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?`;

console.log(`Executing with input "${input}"...`);

const result = await executor.invoke({ input });

console.log(`Got output ${result.output}`);
/**
 * Got output Harry Styles, Olivia Wilde's boyfriend, is 29 years old and his age raised to the 0.23 power is 2.169459462491557.
 */
