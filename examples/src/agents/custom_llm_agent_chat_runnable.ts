import { AgentExecutor } from "langchain/agents";
import { formatForOpenAIFunctions } from "langchain/agents/format_scratchpad";
import { ChatOpenAI } from "langchain/chat_models/openai";
import {
  BaseChatPromptTemplate,
  ChatPromptTemplate,
  MessagesPlaceholder,
  PromptTemplate,
  SerializedBasePromptTemplate,
} from "langchain/prompts";
import {
  AgentAction,
  AgentFinish,
  AgentStep,
  BaseMessage,
  InputValues,
  PartialValues,
  SystemMessage,
} from "langchain/schema";
import { RunnableSequence } from "langchain/schema/runnable";
import { SerpAPI, Tool } from "langchain/tools";
import { Calculator } from "langchain/tools/calculator";

const PREFIX = `Answer the following questions as best you can. You have access to the following tools:
Tools {tools}`;

const TOOL_INSTRUCTIONS_TEMPLATE = `Use the following format in your response:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question`;
const SUFFIX = `Begin!

Question: {input}`;

class CustomPromptTemplate extends BaseChatPromptTemplate {
  tools: Array<Tool>;

  constructor(args: { tools: Array<Tool>; inputVariables: Array<string> }) {
    super({ inputVariables: args.inputVariables });
    this.tools = args.tools;
  }

  _getPromptType(): string {
    throw new Error("Not implemented");
  }

  async formatMessages(values: InputValues): Promise<Array<BaseMessage>> {
    /** Check input and intermediate steps are both inside values */
    if (!("input" in values) || !("intermediate_steps" in values)) {
      throw new Error("Missing input or agent_scratchpad from values.");
    }
    /** Extract and case the intermediateSteps from values as Array<AgentStep> */
    const intermediateSteps = values.intermediate_steps as Array<AgentStep>;
    /** Call the helper `formatForOpenAIFunctions` which returns the steps as `Array<BaseMessage>`  */
    const agentScratchpad = formatForOpenAIFunctions(intermediateSteps);
    /** Construct the tool strings */
    const toolStrings = this.tools
      .map((tool) => `${tool.name}: ${tool.description}`)
      .join("\n");
    const toolNames = this.tools.map((tool) => tool.name).join("\n");
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
    /** Construct the chat prompt template */
    const chatPrompt = ChatPromptTemplate.fromMessages([
      new SystemMessage(formattedPrefix),
      new SystemMessage(formattedInstructions),
      new MessagesPlaceholder("agent_scratchpad"),
      new SystemMessage(formattedSuffix),
    ]);
    /** Convert the prompt template to a string */
    const formatted = await chatPrompt.format({
      agent_scratchpad: agentScratchpad,
    });
    /** Return the formatted message */
    return [new SystemMessage(formatted)];
  }

  partial(_values: PartialValues): Promise<BaseChatPromptTemplate> {
    throw new Error("Not implemented");
  }

  serialize(): SerializedBasePromptTemplate {
    throw new Error("Not implemented");
  }
}

/** Define the custom output parser */
function customOutputParser(message: BaseMessage): AgentAction | AgentFinish {
  console.log("message: ", message);
  const text = message.content;
  /** If the input includes "Final Answer" return as an instance of `AgentFinish` */
  if (text.includes("Final Answer:")) {
    const parts = text.split("Final Answer:");
    const input = parts[parts.length - 1].trim();
    const finalAnswers = { output: input };
    return { log: text, returnValues: finalAnswers };
  }
  /** Use RegEx to extract any actions and their values */
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

/** Instantiate the chat model and bind the stop token */
const model = new ChatOpenAI({ temperature: 0 }).bind({
  stop: ["\nObservation"],
});
/** B */
/** Define the tools */
const tools = [
  new SerpAPI(process.env.SERPAPI_API_KEY, {
    location: "Austin,Texas,United States",
    hl: "en",
    gl: "us",
  }),
  new Calculator(),
];
/** Define the Runnable with LCEL */
const runnable = RunnableSequence.from([
  {
    input: (values: InputValues) => values.input,
    intermediate_steps: (values: InputValues) => values.intermediate_steps,
  },
  new CustomPromptTemplate({
    tools,
    inputVariables: ["input", "intermediate_steps"],
  }),
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

const result = await executor.call({ input });

console.log(`Got output ${result.output}`);
