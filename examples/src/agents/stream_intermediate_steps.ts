import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { ChatOpenAI } from "@langchain/openai";
import type { ChatPromptTemplate } from "@langchain/core/prompts";

import { Calculator } from "langchain/tools/calculator";
import { pull } from "langchain/hub";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";

// Define the tools the agent will have access to.
const tools = [new TavilySearchResults({}), new Calculator()];

const llm = new ChatOpenAI({
  modelName: "gpt-3.5-turbo-1106",
  temperature: 0,
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

const stream = await agentExecutor.stream({
  input: "what is the weather in SF and then LA",
});

for await (const chunk of stream) {
  console.log(JSON.stringify(chunk, null, 2));
  console.log("------");
}

/*
  {
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
                "AIMessage"
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
        "observation": "[{\"title\":\"December 27, 2023 San Francisco Bay Area weather forecast - MSN\",\"url\":\"https://www.msn.com/en-us/weather/topstories/december-27-2023-san-francisco-bay-area-weather-forecast/vi-AA1m61SY\",\"content\":\"Struggling retailer's CEO blames 'lazy' workers KRON4 Meteorologist John Shrable has the latest update on the unsettled weather system moving in on Wednesday....\",\"score\":0.96286,\"raw_content\":null},{\"title\":\"Weather in December 2023 in San Francisco, California, USA\",\"url\":\"https://www.timeanddate.com/weather/@5391959/historic?month=12&year=2023\",\"content\":\"Currently: 52 °F. Broken clouds. (Weather station: San Francisco International Airport, USA). See more current weather Select month: December 2023 Weather in San Francisco — Graph °F Sun, Dec 17 Lo:55 6 pm Hi:57 4 Mon, Dec 18 Lo:54 12 am Hi:55 7 Lo:54 6 am Hi:55 10 Lo:57 12 pm Hi:64 9 Lo:63 6 pm Hi:64 14 Tue, Dec 19 Lo:61\",\"score\":0.95828,\"raw_content\":null},{\"title\":\"December 27, 2023 San Francisco Bay Area weather forecast - Yahoo News\",\"url\":\"https://news.yahoo.com/december-27-2023-san-francisco-132217865.html\",\"content\":\"Wed, December 27, 2023, 8:22 AM EST KRON4 Meteorologist John Shrable has the latest update on the unsettled weather system moving in on Wednesday....\",\"score\":0.90699,\"raw_content\":null},{\"title\":\"Weather in San Francisco in December 2023\",\"url\":\"https://world-weather.info/forecast/usa/san_francisco/december-2023/\",\"content\":\"Mon Tue Wed Thu Fri Sat 1 +59° +54° 2 +61° +55° 3 +63° +55° 4 +63° +55° 5 +64° +54° 6 +61° +54° 7 +59°\",\"score\":0.90409,\"raw_content\":null},{\"title\":\"San Francisco, CA Hourly Weather Forecast | Weather Underground\",\"url\":\"https://www.wunderground.com/hourly/us/ca/san-francisco/date/2023-12-27\",\"content\":\"Wednesday Night 12/27. 57 % / 0.09 in. Considerable cloudiness with occasional rain showers. Low 54F. Winds SSE at 5 to 10 mph. Chance of rain 60%.\",\"score\":0.90221,\"raw_content\":null}]"
      }
    ]
  }
  ------
  {
    "intermediateSteps": [
      {
        "action": {
          "tool": "tavily_search_results_json",
          "toolInput": {
            "input": "weather in Los Angeles"
          },
          "log": "Invoking \"tavily_search_results_json\" with {\"input\":\"weather in Los Angeles\"}\n",
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
                    "name": "tavily_search_results_json",
                    "arguments": "{\"input\":\"weather in Los Angeles\"}"
                  }
                }
              }
            }
          ]
        },
        "observation": "[{\"title\":\"Los Angeles, CA Hourly Weather Forecast | Weather Underground\",\"url\":\"https://www.wunderground.com/hourly/us/ca/los-angeles/date/2023-12-22\",\"content\":\"Hourly Forecast for Friday 12/22 Friday 12/22 67 % / 0.09 in Rain showers early with some sunshine later in the day. High 64F. Winds light and variable. Chance of rain 70%. Friday Night 12/22...\",\"score\":0.97854,\"raw_content\":null},{\"title\":\"Weather in December 2023 in Los Angeles, California, USA - timeanddate.com\",\"url\":\"https://www.timeanddate.com/weather/usa/los-angeles/historic?month=12&year=2023\",\"content\":\"Currently: 61 °F. Clear. (Weather station: Los Angeles / USC Campus Downtown, USA). See more current weather Select month: December 2023 Weather in Los Angeles — Graph °F Sun, Dec 10 Lo:59 6 pm Hi:61 1 Mon, Dec 11 Lo:54 12 am Hi:59 2 Lo:52 6 am Hi:72 1 Lo:63 12 pm Hi:73 0 Lo:54 6 pm Hi:59 0 Tue, Dec 12 Lo:50\",\"score\":0.92493,\"raw_content\":null},{\"title\":\"Los Angeles, California December 2023 Weather Forecast - detailed\",\"url\":\"https://www.weathertab.com/en/g/o/12/united-states/california/los-angeles/\",\"content\":\"Free Long Range Weather Forecast for Los Angeles, California December 2023. Detailed graphs of monthly weather forecast, temperatures, and degree days. Enter any city, zip or place. °F °C. Help. United States ... Helping You Avoid Bad Weather. 30 days and beyond. Daily Forecast Daily;\",\"score\":0.91283,\"raw_content\":null},{\"title\":\"Weather in Los Angeles in December 2023\",\"url\":\"https://world-weather.info/forecast/usa/los_angeles/december-2023/\",\"content\":\"Los Angeles Weather Forecast for December 2023 is based on long term prognosis and previous years' statistical data. 2015 2016 2017 2018 2019 2020 2021 2022 2023 2024 Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec December Start Week On Sunday Monday Sun Mon Tue Wed Thu Fri Sat 1 +66° +54° 2 +66° +52° 3 +66° +52° 4 +72° +55° 5 +77° +57° 6 +70°\",\"score\":0.91028,\"raw_content\":null},{\"title\":\"Los Angeles, California Long Range Weather Forecast\",\"url\":\"https://www.weathertab.com/en/c/2023/12/united-states/california/los-angeles/\",\"content\":\"United States Los Angeles, California Long Range Weather Forecast Helping You Avoid Bad Weather. 30 days and beyond. Daily ForecastDaily Calendar ForecastCalendar Detailed ForecastDetail December 2023Dec 2023\",\"score\":0.90321,\"raw_content\":null}]"
      }
    ]
  }
  ------
  {
    "output": "The current weather in San Francisco is 52°F with broken clouds. You can find more details about the weather forecast for San Francisco [here](https://www.timeanddate.com/weather/@5391959/historic?month=12&year=2023).\n\nThe current weather in Los Angeles is 61°F with clear skies. You can find more details about the weather forecast for Los Angeles [here](https://www.timeanddate.com/weather/usa/los-angeles/historic?month=12&year=2023)."
  }
  ------
*/
