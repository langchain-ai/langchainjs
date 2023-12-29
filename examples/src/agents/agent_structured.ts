import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";
import {
  type BaseMessage,
  AIMessage,
  FunctionMessage,
  type AgentFinish,
  type AgentStep,
} from "langchain/schema";
import { RunnableSequence } from "langchain/runnables";
import { ChatPromptTemplate, MessagesPlaceholder } from "langchain/prompts";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { AgentExecutor } from "langchain/agents";
import { formatToOpenAIFunction, DynamicTool } from "langchain/tools";
import type { FunctionsAgentAction } from "langchain/agents/openai/output_parser";

import { TavilySearchAPIRetriever } from "@langchain/community/retrievers/tavily_search_api";

const llm = new ChatOpenAI({
  modelName: "gpt-4-1106-preview",
});

const searchTool = new DynamicTool({
  name: "web-search-tool",
  description: "Tool for getting the latest information from the web",
  func: async (searchQuery: string, runManager) => {
    const retriever = new TavilySearchAPIRetriever();
    const docs = await retriever.invoke(searchQuery, runManager?.getChild());
    return docs.map((doc) => doc.pageContent).join("\n-----\n");
  },
});

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "You are a helpful assistant. You must always call one of the provided tools.",
  ],
  ["user", "{input}"],
  new MessagesPlaceholder("agent_scratchpad"),
]);

const responseSchema = z.object({
  answer: z.string().describe("The final answer to return to the user"),
  sources: z
    .array(z.string())
    .describe(
      "List of page chunks that contain answer to the question. Only include a page chunk if it contains relevant information"
    ),
});

const responseOpenAIFunction = {
  name: "response",
  description: "Return the response to the user",
  parameters: zodToJsonSchema(responseSchema),
};

const structuredOutputParser = (
  message: AIMessage
): FunctionsAgentAction | AgentFinish => {
  if (message.content && typeof message.content !== "string") {
    throw new Error("This agent cannot parse non-string model responses.");
  }
  if (message.additional_kwargs.function_call) {
    const { function_call } = message.additional_kwargs;
    try {
      const toolInput = function_call.arguments
        ? JSON.parse(function_call.arguments)
        : {};
      // If the function call name is `response` then we know it's used our final
      // response function and can return an instance of `AgentFinish`
      if (function_call.name === "response") {
        return { returnValues: { ...toolInput }, log: message.content };
      }
      return {
        tool: function_call.name,
        toolInput,
        log: `Invoking "${function_call.name}" with ${
          function_call.arguments ?? "{}"
        }\n${message.content}`,
        messageLog: [message],
      };
    } catch (error) {
      throw new Error(
        `Failed to parse function arguments from chat model response. Text: "${function_call.arguments}". ${error}`
      );
    }
  } else {
    return {
      returnValues: { output: message.content },
      log: message.content,
    };
  }
};

const formatAgentSteps = (steps: AgentStep[]): BaseMessage[] =>
  steps.flatMap(({ action, observation }) => {
    if ("messageLog" in action && action.messageLog !== undefined) {
      const log = action.messageLog as BaseMessage[];
      return log.concat(new FunctionMessage(observation, action.tool));
    } else {
      return [new AIMessage(action.log)];
    }
  });

const llmWithTools = llm.bind({
  functions: [formatToOpenAIFunction(searchTool), responseOpenAIFunction],
});
/** Create the runnable */
const runnableAgent = RunnableSequence.from<{
  input: string;
  steps: Array<AgentStep>;
}>([
  {
    input: (i) => i.input,
    agent_scratchpad: (i) => formatAgentSteps(i.steps),
  },
  prompt,
  llmWithTools,
  structuredOutputParser,
]);

const executor = AgentExecutor.fromAgentAndTools({
  agent: runnableAgent,
  tools: [searchTool],
});
/** Call invoke on the agent */
const res = await executor.invoke({
  input: "what is the current weather in honolulu?",
});
console.log({
  res,
});

/*
  {
    res: {
      answer: 'The current weather in Honolulu is 71 \bF with light rain and broken clouds.',
      sources: [
        'Currently: 71 \bF. Light rain. Broken clouds. (Weather station: Honolulu International Airport, USA). See more current weather'
      ]
    }
  }
*/
