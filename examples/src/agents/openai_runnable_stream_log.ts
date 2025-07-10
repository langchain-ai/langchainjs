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

const model = new ChatOpenAI({
  model: "gpt-4",
  streaming: true,
  temperature: 0,
});

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

const stream = await executor.streamLog({
  input: "What is the weather in New York?",
});

for await (const chunk of stream) {
  console.log(JSON.stringify(chunk, null, 2));
}

/*
  {
    "ops": [
      {
        "op": "replace",
        "path": "",
        "value": {
          "id": "7f0cee79-7dbb-4ded-aedf-ccc4849f5285",
          "streamed_output": [],
          "logs": {}
        }
      }
    ]
  }
  ...
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI/final_output",
        "value": {
          "generations": [
            [
              {
                "text": "",
                "generationInfo": {
                  "prompt": 0,
                  "completion": 0
                },
                "message": {
                  "lc": 1,
                  "type": "constructor",
                  "id": [
                    "langchain_core",
                    "messages",
                    "AIMessageChunk"
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
              }
            ]
          ],
          "llmOutput": {
            "estimatedTokenUsage": {
              "promptTokens": 123,
              "completionTokens": 17,
              "totalTokens": 140
            }
          }
        }
      },
      {
        "op": "add",
        "path": "/logs/ChatOpenAI/end_time",
        "value": "2023-12-22T23:52:39.306Z"
      }
    ]
  }
  ...
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/SerpAPI/final_output",
        "value": {
          "output": "{\"type\":\"weather_result\",\"temperature\":\"36\",\"unit\":\"Fahrenheit\",\"precipitation\":\"0%\",\"humidity\":\"37%\",\"wind\":\"3 mph\",\"location\":\"New York, NY\",\"date\":\"Friday 5:00 PM\",\"weather\":\"Clear\"}"
        }
      },
      {
        "op": "add",
        "path": "/logs/SerpAPI/end_time",
        "value": "2023-12-22T23:52:39.943Z"
      }
    ]
  }
  ...
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "The"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " current"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " weather"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " in"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " New"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " York"
      }
    ]
  }
  ...
  {
    "ops": [
      {
        "op": "add",
        "path": "/streamed_output/-",
        "value": {
          "output": "The current weather in New York is clear with a temperature of 36 degrees Fahrenheit. The humidity is at 37% and the wind is blowing at 3 mph. There is 0% chance of precipitation."
        }
      }
    ]
  }
*/
