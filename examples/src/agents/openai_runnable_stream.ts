import { AgentExecutor } from "langchain/agents";
import { ChatOpenAI } from "@langchain/openai";
import { Calculator } from "@langchain/community/tools/calculator";
import { OpenAIFunctionsAgentOutputParser } from "langchain/agents/openai/output_parser";
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
import { SerpAPI } from "@langchain/community/tools/serpapi";

/** Define your list of tools. */
const tools = [new Calculator(), new SerpAPI()];

const model = new ChatOpenAI({ model: "gpt-4", temperature: 0 });

const prompt = ChatPromptTemplate.fromMessages([
  ["ai", "You are a helpful assistant"],
  ["human", "{input}"],
  new MessagesPlaceholder("agent_scratchpad"),
]);

const modelWithFunctions = model.bindTools(tools);

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
  modelWithFunctions,
  new OpenAIFunctionsAgentOutputParser(),
]);

const executor = AgentExecutor.fromAgentAndTools({
  agent: runnableAgent,
  tools,
});

const stepStream = await executor.stream({
  input: "What is the weather in New York?",
});

for await (const step of stepStream) {
  console.log(JSON.stringify(step, null, 2));
}

/*
  {
    "intermediateSteps": [
      {
        "action": {
          "tool": "search",
          "toolInput": {
            "input": "current weather in New York"
          },
          "log": "Invoking \"search\" with {\n  \"input\": \"current weather in New York\"\n}\n",
          "messageLog": [
            {
              "lc": 1,
              "type": "constructor",
              "id": [
                "langchain_core",
                "messages",
                "AIMessage"
              ],
              "kwargs": {
                "content": "",
                "additional_kwargs": {
                  "function_call": {
                    "name": "search",
                    "arguments": "{\n  \"input\": \"current weather in New York\"\n}"
                  }
                }
              }
            }
          ]
        },
        "observation": "{\"type\":\"weather_result\",\"temperature\":\"36\",\"unit\":\"Fahrenheit\",\"precipitation\":\"0%\",\"humidity\":\"37%\",\"wind\":\"3 mph\",\"location\":\"New York, NY\",\"date\":\"Friday 5:00 PM\",\"weather\":\"Clear\"}"
      }
    ]
  }
*/

/*
  {
    "output": "The current weather in New York is clear with a temperature of 36 degrees Fahrenheit. The humidity is at 37% and the wind is blowing at 3 mph. There is 0% chance of precipitation."
  }
*/
