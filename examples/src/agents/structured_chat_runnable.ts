import { z } from "zod";
import { ChatOpenAI } from "langchain/chat_models/openai";
import {
  AgentExecutor,
  StructuredChatOutputParserWithRetries,
} from "langchain/agents";
import { Calculator } from "langchain/tools/calculator";
import { DynamicStructuredTool } from "langchain/tools";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  PromptTemplate,
  SystemMessagePromptTemplate,
} from "langchain/prompts";
import { renderTextDescriptionAndArgs } from "langchain/tools/render";
import { RunnableSequence } from "langchain/schema/runnable";
import { AgentStep } from "langchain/schema";
import { formatLogToString } from "langchain/agents/format_scratchpad/log";

/**
 * Need:
 * memory
 * multi input tools
 */

/** Define the chat model. */
const model = new ChatOpenAI({ temperature: 0 }).bind({
  stop: ["\nObservation:"],
});
/** Define your list of tools, including the `DynamicStructuredTool` */
const tools = [
  new Calculator(), // Older existing single input tools will still work
  new DynamicStructuredTool({
    name: "random-number-generator",
    description: "generates a random number between two input numbers",
    schema: z.object({
      low: z.number().describe("The lower bound of the generated number"),
      high: z.number().describe("The upper bound of the generated number"),
    }),
    func: async ({ low, high }) =>
      (Math.random() * (high - low) + low).toString(), // Outputs still must be strings
    returnDirect: false, // This is an option that allows the tool to return the output directly
  }),
];
const toolNames = tools.map((tool) => tool.name);

/**
 * Create your prompt.
 * Here we'll use three prompt strings: prefix, format instructions and suffix.
 * With these we'll format the prompt with the tool schemas and names.
 */
const PREFIX = `Answer the following questions truthfully and as best you can.`;
const AGENT_ACTION_FORMAT_INSTRUCTIONS = `Output a JSON markdown code snippet containing a valid JSON blob (denoted below by $JSON_BLOB).
This $JSON_BLOB must have a "action" key (with the name of the tool to use) and an "action_input" key (tool input).

Valid "action" values: "Final Answer" (which you must use when giving your final response to the user), or one of [{tool_names}].

The $JSON_BLOB must be valid, parseable JSON and only contain a SINGLE action. Here is an example of an acceptable output:

\`\`\`json
{{
  "action": $TOOL_NAME,
  "action_input": $INPUT
}}
\`\`\`

Remember to include the surrounding markdown code snippet delimiters (begin with "\`\`\`" json and close with "\`\`\`")!
`;
const FORMAT_INSTRUCTIONS = `You have access to the following tools.
You must format your inputs to these tools to match their "JSON schema" definitions below.

"JSON Schema" is a declarative language that allows you to annotate and validate JSON documents.

For example, the example "JSON Schema" instance {{"properties": {{"foo": {{"description": "a list of test words", "type": "array", "items": {{"type": "string"}}}}}}, "required": ["foo"]}}}}
would match an object with one required property, "foo". The "type" property specifies "foo" must be an "array", and the "description" property semantically describes it as "a list of test words". The items within "foo" must be strings.
Thus, the object {{"foo": ["bar", "baz"]}} is a well-formatted instance of this example "JSON Schema". The object {{"properties": {{"foo": ["bar", "baz"]}}}} is not well-formatted.

Here are the JSON Schema instances for the tools you have access to:

{tool_schemas}

The way you use the tools is as follows:

------------------------

${AGENT_ACTION_FORMAT_INSTRUCTIONS}

If you are using a tool, "action_input" must adhere to the tool's input schema, given above.

------------------------

ALWAYS use the following format:

Question: the input question you must answer
Thought: you should always think about what to do
Action:
\`\`\`json
$JSON_BLOB
\`\`\`
Observation: the result of the action
... (this Thought/Action/Observation can repeat N times)
Thought: I now know the final answer
Action:
\`\`\`json
{{
  "action": "Final Answer",
  "action_input": "Final response to human"
}}
\`\`\``;
const SUFFIX = `Begin! Reminder to ALWAYS use the above format, and to use tools if appropriate.`;
const inputVariables = ["input", "agent_scratchpad"];
const template = [
  PREFIX,
  FORMAT_INSTRUCTIONS,
  SUFFIX,
  `Thoughts: {agent_scratchpad}`,
].join("\n\n");
const humanMessageTemplate = "{input}";
const messages = [
  new SystemMessagePromptTemplate(
    new PromptTemplate({
      template,
      inputVariables,
      partialVariables: {
        tool_schemas: renderTextDescriptionAndArgs(tools),
        tool_names: toolNames.join(", "),
      },
    })
  ),
  new HumanMessagePromptTemplate(
    new PromptTemplate({
      template: humanMessageTemplate,
      inputVariables,
    })
  ),
];
const prompt = ChatPromptTemplate.fromMessages(messages);

/**
 * Now we can create our output parser.
 * For this, we'll use the pre-built `StructuredChatOutputParserWithRetries`
 *
 * @important This step is very important and not to be overlooked for one main reason: retries.
 * If the agent fails to produce a valid output, it will preform retries to try and coerce the agent
 * into producing a valid output.
 *
 * @important You can not pass in the same model we're using in the executor since it has stop tokens
 * bound to it, and the implementation of `StructuredChatOutputParserWithRetries.fromLLM` does not accept
 * LLMs of this type.
 */
const outputParser = StructuredChatOutputParserWithRetries.fromLLM(
  new ChatOpenAI({ temperature: 0 }),
  {
    toolNames,
  }
);

/**
 * Finally, construct the runnable agent using a
 * `RunnableSequence` and pass it to the agent executor
 */
const runnableAgent = RunnableSequence.from([
  {
    input: (i: { input: string; steps: AgentStep[] }) => i.input,
    agent_scratchpad: (i: { input: string; steps: AgentStep[] }) =>
      formatLogToString(i.steps),
  },
  prompt,
  model,
  outputParser,
]);

const executor = AgentExecutor.fromAgentAndTools({
  agent: runnableAgent,
  tools,
});

console.log("Loaded agent.");

const input = `What is a random number between 5 and 10 raised to the second power?`;
console.log(`Executing with input "${input}"...`);
const result = await executor.invoke({ input });
console.log(result);

/*
Loaded agent.
Executing with input "What is a random number between 5 and 10 raised to the second power?"...
{ output: '67.02412461717323' }
*/
