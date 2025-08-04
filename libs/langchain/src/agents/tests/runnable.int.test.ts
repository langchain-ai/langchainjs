/* eslint-disable no-process-env */
import { test } from "@jest/globals";
import { ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import {
  AIMessage,
  BaseMessage,
  FunctionMessage,
} from "@langchain/core/messages";
import { AgentStep } from "@langchain/core/agents";
import { RunnableSequence } from "@langchain/core/runnables";
import { AgentExecutor } from "../executor.js";
import { SerpAPI } from "../../util/testing/tools/serpapi.js";
import { Calculator } from "../../util/testing/tools/calculator.js";
import { OpenAIFunctionsAgentOutputParser } from "../openai/output_parser.js";

test("Runnable variant", async () => {
  const tools = [new Calculator(), new SerpAPI()];
  const model = new ChatOpenAI({ model: "gpt-4", temperature: 0 });

  const prompt = ChatPromptTemplate.fromMessages([
    ["ai", "You are a helpful assistant"],
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  const modelWithTools = model.bindTools(tools);

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

  // console.log("Loaded agent executor");

  const query = "What is the weather in New York?";
  // console.log(`Calling agent executor with query: ${query}`);
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const result = await executor.invoke({
    input: query,
  });
  // console.log(result);
});

test("Runnable variant executor astream log", async () => {
  const tools = [new Calculator(), new SerpAPI()];
  const model = new ChatOpenAI({
    model: "gpt-4",
    temperature: 0,
    streaming: true,
  });

  const prompt = ChatPromptTemplate.fromMessages([
    ["ai", "You are a helpful assistant"],
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  const modelWithTools = model.bindTools(tools);

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

  // console.log("Loaded agent executor");

  const query = "What is the weather in New York?";
  // console.log(`Calling agent executor with query: ${query}`);
  const stream = await executor.streamLog({
    input: query,
  });
  let hasSeenLLMLogPatch = false;
  for await (const chunk of stream) {
    // console.log(JSON.stringify(chunk));
    if (chunk.ops[0].path.includes("ChatOpenAI")) {
      hasSeenLLMLogPatch = true;
    }
  }
  expect(hasSeenLLMLogPatch).toBe(true);
});
