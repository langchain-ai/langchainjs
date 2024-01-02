import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { ChatOpenAI } from "@langchain/openai";
import type { ChatPromptTemplate } from "@langchain/core/prompts";

import { pull } from "langchain/hub";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";

// Define the tools the agent will have access to.
const tools = [new TavilySearchResults({})];

const llm = new ChatOpenAI({
  modelName: "gpt-3.5-turbo-1106",
  temperature: 0,
  streaming: true,
});

// Get the prompt to use - you can modify this!
// If you want to see the prompt in full, you can at:
// https://smith.langchain.com/hub/hwchase17/openai-functions-agent
const prompt = await pull<ChatPromptTemplate>(
  "hwchase17/openai-functions-agent"
);

const agent = await createOpenAIFunctionsAgent({
  llm,
  tools,
  prompt,
});

const agentExecutor = new AgentExecutor({
  agent,
  tools,
});

const logStream = await agentExecutor.streamLog({
  input: "what is the weather in SF",
});

for await (const chunk of logStream) {
  console.log(JSON.stringify(chunk, null, 2));
}
/*
  {
    "ops": [
      {
        "op": "replace",
        "path": "",
        "value": {
          "id": "b45fb674-f391-4976-a13a-93116c1299b3",
          "streamed_output": [],
          "logs": {}
        }
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/RunnableAgent",
        "value": {
          "id": "347b79d7-28b1-4be4-8de4-a7a6f633b397",
          "name": "RunnableAgent",
          "type": "chain",
          "tags": [],
          "metadata": {},
          "start_time": "2023-12-27T23:33:49.796Z",
          "streamed_output_str": []
        }
      }
    ]
  }
  ...
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/RunnableAgent/final_output",
        "value": {
          "tool": "tavily_search_results_json",
          "toolInput": {
            "input": "weather in San Francisco"
          },
          "log": "Invoking \"tavily_search_results_json\" with {\"input\":\"weather in San Francisco\"}\n",
          "messageLog": [
            {
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
                    "name": "tavily_search_results_json",
                    "arguments": "{\"input\":\"weather in San Francisco\"}"
                  }
                }
              }
            }
          ]
        }
      },
      {
        "op": "add",
        "path": "/logs/RunnableAgent/end_time",
        "value": "2023-12-27T23:33:51.902Z"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/TavilySearchResults",
        "value": {
          "id": "9ee31774-1a96-4d78-93c5-6aac11591667",
          "name": "TavilySearchResults",
          "type": "tool",
          "tags": [],
          "metadata": {},
          "start_time": "2023-12-27T23:33:51.970Z",
          "streamed_output_str": []
        }
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/TavilySearchResults/final_output",
        "value": {
          "output": "[{\"title\":\"December 27, 2023 San Francisco Bay Area weather forecast - Yahoo News\",\"url\":\"https://news.yahoo.com/december-27-2023-san-francisco-132217865.html\",\"content\":\"Wed, December 27, 2023, 8:22 AM EST KRON4 Meteorologist John Shrable has the latest update on the unsettled weather system moving in on Wednesday....\",\"score\":0.9679,\"raw_content\":null},{\"title\":\"San Francisco, CA Hourly Weather Forecast | Weather Underground\",\"url\":\"https://www.wunderground.com/hourly/us/ca/san-francisco/date/2023-12-27\",\"content\":\"Hourly Forecast for Wednesday 12/27 Wednesday 12/27 80 % / 0.28 in Rain likely. High near 60F. Winds SSE at 10 to 20 mph. Chance of rain 80%. Rainfall near a quarter of an inch. Wednesday...\",\"score\":0.95315,\"raw_content\":null},{\"title\":\"December 27, 2023 San Francisco Bay Area weather forecast - MSN\",\"url\":\"https://www.msn.com/en-us/weather/topstories/december-27-2023-san-francisco-bay-area-weather-forecast/vi-AA1m61SY\",\"content\":\"Struggling retailer's CEO blames 'lazy' workers KRON4 Meteorologist John Shrable has the latest update on the unsettled weather system moving in on Wednesday....\",\"score\":0.94448,\"raw_content\":null},{\"title\":\"Weather in December 2023 in San Francisco, California, USA\",\"url\":\"https://www.timeanddate.com/weather/@5391959/historic?month=12&year=2023\",\"content\":\"Currently: 52 °F. Broken clouds. (Weather station: San Francisco International Airport, USA). See more current weather Select month: December 2023 Weather in San Francisco — Graph °F Sun, Dec 17 Lo:55 6 pm Hi:57 4 Mon, Dec 18 Lo:54 12 am Hi:55 7 Lo:54 6 am Hi:55 10 Lo:57 12 pm Hi:64 9 Lo:63 6 pm Hi:64 14 Tue, Dec 19 Lo:61\",\"score\":0.93301,\"raw_content\":null},{\"title\":\"Weather in San Francisco in December 2023\",\"url\":\"https://world-weather.info/forecast/usa/san_francisco/december-2023/\",\"content\":\"Mon Tue Wed Thu Fri Sat 1 +59° +54° 2 +61° +55° 3 +63° +55° 4 +63° +55° 5 +64° +54° 6 +61° +54° 7 +59°\",\"score\":0.91495,\"raw_content\":null}]"
        }
      },
      {
        "op": "add",
        "path": "/logs/TavilySearchResults/end_time",
        "value": "2023-12-27T23:33:53.615Z"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/streamed_output/-",
        "value": {
          "intermediateSteps": [
            {
              "action": {
                "tool": "tavily_search_results_json",
                "toolInput": {
                  "input": "weather in San Francisco"
                },
                "log": "Invoking \"tavily_search_results_json\" with {\"input\":\"weather in San Francisco\"}\n",
                "messageLog": [
                  {
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
                          "name": "tavily_search_results_json",
                          "arguments": "{\"input\":\"weather in San Francisco\"}"
                        }
                      }
                    }
                  }
                ]
              },
              "observation": "[{\"title\":\"December 27, 2023 San Francisco Bay Area weather forecast - Yahoo News\",\"url\":\"https://news.yahoo.com/december-27-2023-san-francisco-132217865.html\",\"content\":\"Wed, December 27, 2023, 8:22 AM EST KRON4 Meteorologist John Shrable has the latest update on the unsettled weather system moving in on Wednesday....\",\"score\":0.9679,\"raw_content\":null},{\"title\":\"San Francisco, CA Hourly Weather Forecast | Weather Underground\",\"url\":\"https://www.wunderground.com/hourly/us/ca/san-francisco/date/2023-12-27\",\"content\":\"Hourly Forecast for Wednesday 12/27 Wednesday 12/27 80 % / 0.28 in Rain likely. High near 60F. Winds SSE at 10 to 20 mph. Chance of rain 80%. Rainfall near a quarter of an inch. Wednesday...\",\"score\":0.95315,\"raw_content\":null},{\"title\":\"December 27, 2023 San Francisco Bay Area weather forecast - MSN\",\"url\":\"https://www.msn.com/en-us/weather/topstories/december-27-2023-san-francisco-bay-area-weather-forecast/vi-AA1m61SY\",\"content\":\"Struggling retailer's CEO blames 'lazy' workers KRON4 Meteorologist John Shrable has the latest update on the unsettled weather system moving in on Wednesday....\",\"score\":0.94448,\"raw_content\":null},{\"title\":\"Weather in December 2023 in San Francisco, California, USA\",\"url\":\"https://www.timeanddate.com/weather/@5391959/historic?month=12&year=2023\",\"content\":\"Currently: 52 °F. Broken clouds. (Weather station: San Francisco International Airport, USA). See more current weather Select month: December 2023 Weather in San Francisco — Graph °F Sun, Dec 17 Lo:55 6 pm Hi:57 4 Mon, Dec 18 Lo:54 12 am Hi:55 7 Lo:54 6 am Hi:55 10 Lo:57 12 pm Hi:64 9 Lo:63 6 pm Hi:64 14 Tue, Dec 19 Lo:61\",\"score\":0.93301,\"raw_content\":null},{\"title\":\"Weather in San Francisco in December 2023\",\"url\":\"https://world-weather.info/forecast/usa/san_francisco/december-2023/\",\"content\":\"Mon Tue Wed Thu Fri Sat 1 +59° +54° 2 +61° +55° 3 +63° +55° 4 +63° +55° 5 +64° +54° 6 +61° +54° 7 +59°\",\"score\":0.91495,\"raw_content\":null}]"
            }
          ]
        }
      }
    ]
  }
  ...
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2",
        "value": {
          "id": "7c5a39b9-1b03-4291-95d1-a775edc92aee",
          "name": "ChatOpenAI",
          "type": "llm",
          "tags": [
            "seq:step:3"
          ],
          "metadata": {},
          "start_time": "2023-12-27T23:33:54.180Z",
          "streamed_output_str": []
        }
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": ""
      }
    ]
  }
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
        "value": " San"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " Francisco"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " is"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " "
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "52"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "°F"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " with"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " broken"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " clouds"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "."
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " There"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " is"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " also"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " a"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " forecast"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " for"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " rain"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " likely"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " with"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " a"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " high"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " near"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " "
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "60"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "°F"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " and"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " winds"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " from"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " the"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " SSE"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " at"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " "
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "10"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " to"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " "
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "20"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " mph"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "."
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " If"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " you"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "'d"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " like"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " more"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " detailed"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " information"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": ","
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " you"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " can"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " visit"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " the"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " ["
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "San"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " Francisco"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": ","
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " CA"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " Hour"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "ly"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " Weather"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " Forecast"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "]("
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "https"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "://"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "www"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": ".w"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "under"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "ground"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": ".com"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "/h"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "our"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "ly"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "/us"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "/ca"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "/s"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "an"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "-fr"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "anc"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "isco"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "/date"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "/"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "202"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "3"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "-"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "12"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "-"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "27"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": ")"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": " page"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": "."
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/streamed_output_str/-",
        "value": ""
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/final_output",
        "value": {
          "generations": [
            [
              {
                "text": "The current weather in San Francisco is 52°F with broken clouds. There is also a forecast for rain likely with a high near 60°F and winds from the SSE at 10 to 20 mph. If you'd like more detailed information, you can visit the [San Francisco, CA Hourly Weather Forecast](https://www.wunderground.com/hourly/us/ca/san-francisco/date/2023-12-27) page.",
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
                    "content": "The current weather in San Francisco is 52°F with broken clouds. There is also a forecast for rain likely with a high near 60°F and winds from the SSE at 10 to 20 mph. If you'd like more detailed information, you can visit the [San Francisco, CA Hourly Weather Forecast](https://www.wunderground.com/hourly/us/ca/san-francisco/date/2023-12-27) page.",
                    "additional_kwargs": {}
                  }
                }
              }
            ]
          ],
          "llmOutput": {
            "estimatedTokenUsage": {
              "promptTokens": 720,
              "completionTokens": 92,
              "totalTokens": 812
            }
          }
        }
      },
      {
        "op": "add",
        "path": "/logs/ChatOpenAI:2/end_time",
        "value": "2023-12-27T23:33:55.577Z"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/OpenAIFunctionsAgentOutputParser:2",
        "value": {
          "id": "f58ff4e4-2e65-4dde-8a36-ba188e9eabc7",
          "name": "OpenAIFunctionsAgentOutputParser",
          "type": "parser",
          "tags": [
            "seq:step:4"
          ],
          "metadata": {},
          "start_time": "2023-12-27T23:33:55.742Z",
          "streamed_output_str": []
        }
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/OpenAIFunctionsAgentOutputParser:2/final_output",
        "value": {
          "returnValues": {
            "output": "The current weather in San Francisco is 52°F with broken clouds. There is also a forecast for rain likely with a high near 60°F and winds from the SSE at 10 to 20 mph. If you'd like more detailed information, you can visit the [San Francisco, CA Hourly Weather Forecast](https://www.wunderground.com/hourly/us/ca/san-francisco/date/2023-12-27) page."
          },
          "log": "The current weather in San Francisco is 52°F with broken clouds. There is also a forecast for rain likely with a high near 60°F and winds from the SSE at 10 to 20 mph. If you'd like more detailed information, you can visit the [San Francisco, CA Hourly Weather Forecast](https://www.wunderground.com/hourly/us/ca/san-francisco/date/2023-12-27) page."
        }
      },
      {
        "op": "add",
        "path": "/logs/OpenAIFunctionsAgentOutputParser:2/end_time",
        "value": "2023-12-27T23:33:55.812Z"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/logs/RunnableAgent:2/final_output",
        "value": {
          "returnValues": {
            "output": "The current weather in San Francisco is 52°F with broken clouds. There is also a forecast for rain likely with a high near 60°F and winds from the SSE at 10 to 20 mph. If you'd like more detailed information, you can visit the [San Francisco, CA Hourly Weather Forecast](https://www.wunderground.com/hourly/us/ca/san-francisco/date/2023-12-27) page."
          },
          "log": "The current weather in San Francisco is 52°F with broken clouds. There is also a forecast for rain likely with a high near 60°F and winds from the SSE at 10 to 20 mph. If you'd like more detailed information, you can visit the [San Francisco, CA Hourly Weather Forecast](https://www.wunderground.com/hourly/us/ca/san-francisco/date/2023-12-27) page."
        }
      },
      {
        "op": "add",
        "path": "/logs/RunnableAgent:2/end_time",
        "value": "2023-12-27T23:33:55.872Z"
      }
    ]
  }
  {
    "ops": [
      {
        "op": "replace",
        "path": "/final_output",
        "value": {
          "output": "The current weather in San Francisco is 52°F with broken clouds. There is also a forecast for rain likely with a high near 60°F and winds from the SSE at 10 to 20 mph. If you'd like more detailed information, you can visit the [San Francisco, CA Hourly Weather Forecast](https://www.wunderground.com/hourly/us/ca/san-francisco/date/2023-12-27) page."
        }
      }
    ]
  }
  {
    "ops": [
      {
        "op": "add",
        "path": "/streamed_output/-",
        "value": {
          "output": "The current weather in San Francisco is 52°F with broken clouds. There is also a forecast for rain likely with a high near 60°F and winds from the SSE at 10 to 20 mph. If you'd like more detailed information, you can visit the [San Francisco, CA Hourly Weather Forecast](https://www.wunderground.com/hourly/us/ca/san-francisco/date/2023-12-27) page."
        }
      }
    ]
  }
*/
