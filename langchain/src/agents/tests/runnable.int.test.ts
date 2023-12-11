/* eslint-disable no-process-env */
import { test } from "@jest/globals";
import { AgentExecutor } from "../executor.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { ChatPromptTemplate, MessagesPlaceholder } from "../../prompts/chat.js";
import {
  AIMessage,
  AgentStep,
  BaseMessage,
  FunctionMessage,
} from "../../schema/index.js";
import { RunnableSequence } from "../../schema/runnable/base.js";
import { SerpAPI } from "../../tools/serpapi.js";
import { formatToOpenAIFunction } from "../../tools/convert_to_openai.js";
import { Calculator } from "../../tools/calculator.js";
import { OpenAIFunctionsAgentOutputParser } from "../openai/output_parser.js";
import { LLMChain } from "../../chains/llm_chain.js";
import { OpenAIAgent } from "../openai/index.js";

test("Runnable variant", async () => {
  const tools = [new Calculator(), new SerpAPI()];
  const model = new ChatOpenAI({ modelName: "gpt-4", temperature: 0 });

  const prompt = ChatPromptTemplate.fromMessages([
    ["ai", "You are a helpful assistant"],
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  const modelWithTools = model.bind({
    functions: [...tools.map((tool) => formatToOpenAIFunction(tool))],
  });

  const formatAgentSteps = (steps: AgentStep[]): BaseMessage[] =>
    steps.flatMap(({ action, observation }) => {
      if ("messageLog" in action && action.messageLog !== undefined) {
        const log = action.messageLog as BaseMessage[];
        return log.concat(new FunctionMessage(observation, action.tool));
      } else {
        return [new AIMessage(action.log)];
      }
    });

  const runnableAgent = RunnableSequence.from([
    {
      input: (i: { input: string; steps: AgentStep[] }) => i.input,
      agent_scratchpad: (i: { input: string; steps: AgentStep[] }) =>
        formatAgentSteps(i.steps),
    },
    prompt,
    modelWithTools,
    new OpenAIFunctionsAgentOutputParser(),
  ]);

  const executor = AgentExecutor.fromAgentAndTools({
    agent: runnableAgent,
    tools,
  });

  console.log("Loaded agent executor");

  const query = "What is the weather in New York?";
  console.log(`Calling agent executor with query: ${query}`);
  const result = await executor.invoke({
    input: query,
  });
  console.log(result);
});

test("Runnable variant works with executor", async () => {
  // Prepare tools
  const tools = [new Calculator(), new SerpAPI()];
  const runnableModel = new ChatOpenAI({
    modelName: "gpt-4",
    temperature: 0,
  }).bind({});

  const prompt = ChatPromptTemplate.fromMessages([
    ["ai", "You are a helpful assistant"],
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  // Prepare agent chain
  const llmChain = new LLMChain({
    prompt,
    llm: runnableModel,
  });
  const agent = new OpenAIAgent({
    llmChain,
    tools,
  });

  // Prepare and run executor
  const executor = new AgentExecutor({
    agent,
    tools,
  });
  const result = await executor.invoke({
    input: "What is the weather in New York?",
  });

  console.log(result);
});
